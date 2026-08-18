import { Audio } from "expo-av";
// This SDK's expo-file-system major version moved readAsStringAsync/EncodingType
// under a "/legacy" subpath (the new default export uses File/Directory classes
// instead) -- importing from "expo-file-system" directly triggers a deprecation
// path that isn't fully implemented on web, breaking transcription there.
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { api } from "../api/client";

export type RecordingState = "idle" | "recording" | "transcribing";

// expo-file-system's readAsStringAsync (even the /legacy version) doesn't
// support web at all -- it's built around native filesystem paths, not the
// blob: URLs the browser's MediaRecorder produces. On web we read the blob
// ourselves via fetch + FileReader instead.
async function readUriAsBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return dataUrl.split(",")[1] ?? "";
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

// Wraps expo-av recording + reading the result as base64 + sending it to our
// backend's Whisper-backed /speech/transcribe endpoint. Returns recognized
// text rather than auto-sending it, so the user can review/correct a
// mishearing before it goes into the conversation.
// iOS keeps the audio session in record mode until told otherwise, and while
// it is, playback is attenuated and can route to the earpiece. The app speaks
// the persona's reply immediately after a recording, so leaving this set was
// making the voice quiet or oddly routed for the rest of the session.
async function releaseRecordingMode() {
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  } catch {
    // Best-effort. Failing to restore playback mode is not worth surfacing to
    // someone in the middle of a conversation.
  }
}

export function useVoiceRecording() {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Navigating away mid-recording used to leave the microphone open: there was
  // no cleanup at all, and cancelRecording -- which is exactly this -- was
  // written but never called from anywhere.
  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
      void releaseRecordingMode();
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError("Microphone permission is required to speak your answer.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setState("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start recording. Check microphone access.");
      setState("idle");
    }
  }

  async function stopRecordingAndTranscribe(language?: string): Promise<string | null> {
    const recording = recordingRef.current;
    if (!recording) return null;

    setState("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error("No recording captured");

      const audioBase64 = await readUriAsBase64(uri);
      const mimeType = Platform.OS === "web" ? "audio/webm" : "audio/m4a";

      const result = await api.transcribe(audioBase64, mimeType, language);
      return result.text;
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not hear that. Please try again.");
      return null;
    } finally {
      // Restored here rather than only on unmount, because the very next thing
      // the conversation screen does is speak the reply aloud.
      await releaseRecordingMode();
      setState("idle");
    }
  }

  function cancelRecording() {
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    void releaseRecordingMode();
    setState("idle");
  }

  return { state, error, startRecording, stopRecordingAndTranscribe, cancelRecording };
}
