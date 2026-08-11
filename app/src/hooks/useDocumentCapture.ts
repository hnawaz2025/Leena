import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { api } from "../api/client";

export interface CapturedDocument {
  uri: string;
  text: string;
}

// Photograph-or-pick a document and OCR it. Shared by the deliberate path
// (DocumentUploadScreen, which then lets the user correct the text) and the
// fast path (Home's camera button, which skips straight to an explanation),
// so the permission/picker/extract sequence only exists once.
export function useDocumentCapture() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture(source: "camera" | "library"): Promise<CapturedDocument | null> {
    setError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        source === "camera"
          ? "Camera permission is required to photograph a document."
          : "Photo library permission is required to attach a picture."
      );
      return null;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.base64) return null;

    setScanning(true);
    try {
      const { text } = await api.extractDocumentImage(asset.base64, asset.mimeType ?? "image/jpeg");
      return { uri: asset.uri, text };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo. Try again or paste the text.");
      return null;
    } finally {
      setScanning(false);
    }
  }

  return { capture, scanning, error, setError };
}
