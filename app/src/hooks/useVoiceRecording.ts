import { Audio } from "expo-av";
// This SDK's expo-file-system major version moved readAsStringAsync/EncodingType
// under a "/legacy" subpath (the new default export uses File/Directory classes
// instead) -- importing from "expo-file-system" directly triggers a deprecation
// path that isn't fully implemented on web, breaking transcription there.
import * as FileSystem from "expo-file-system/legacy";
import { useRef, useState } from "react";
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
export function useVoiceRecording() {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

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

  async function stopRecordingAndTranscribe(): Promise<string | null> {
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

      const result = await api.transcribe(audioBase64, mimeType);
      return result.text;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't hear that, try again.");
      return null;
    } finally {
      setState("idle");
    }
  }

  function cancelRecording() {
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    recordingRef.current = null;
    setState("idle");
  }

  return { state, error, startRecording, stopRecordingAndTranscribe, cancelRecording };
}
