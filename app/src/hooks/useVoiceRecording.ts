import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useRef, useState } from "react";
import { Platform } from "react-native";
import { api } from "../api/client";

export type RecordingState = "idle" | "recording" | "transcribing";

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

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
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
