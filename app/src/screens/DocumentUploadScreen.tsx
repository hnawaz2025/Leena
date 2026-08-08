import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Camera, Image as ImageIcon, Lock } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "DocumentUpload">;

// No user-facing document-type picker -- the AI infers what it needs from the
// content itself. "other" is just the DB's generic bucket.
const DOCUMENT_TYPE = "other";

export function DocumentUploadScreen({ navigation }: Props) {
  const [text, setText] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState<"scenario" | "explain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePickImage(source: "camera" | "library") {
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
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;

    setPhotoUri(asset.uri);
    setSavedDocumentId(null); // a new photo means a new document, not the previous saved one
    setScanning(true);
    try {
      const { text: extractedText } = await api.extractDocumentImage(
        asset.base64,
        asset.mimeType ?? "image/jpeg"
      );
      setText(extractedText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo. Try again or paste the text.");
    } finally {
      setScanning(false);
    }
  }

  async function ensureSaved(): Promise<string> {
    if (savedDocumentId) return savedDocumentId;
    const document = await api.createDocument(DOCUMENT_TYPE, text.trim());
    setSavedDocumentId(document.id);
    return document.id;
  }

  async function handleUseForScenario() {
    if (!text.trim()) {
      setError("Add the document text first — paste it or take a photo.");
      return;
    }
    setLoading("scenario");
    setError(null);
    try {
      const documentId = await ensureSaved();
      navigation.navigate("ScenarioSetup", { documentId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleExplainInstead() {
    if (!text.trim()) {
      setError("Add the document text first — paste it or take a photo.");
      return;
    }
    setLoading("explain");
    setError(null);
    try {
      const documentId = await ensureSaved();
      navigation.navigate("DocumentExplanation", { documentId, documentType: DOCUMENT_TYPE });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add a document</Text>
      <Text style={styles.subtitle}>
        Photograph, attach, or paste a document — practice a conversation about it, or get it
        explained in plain language.
      </Text>
      <View style={styles.trustNoteRow}>
        <Lock size={13} color={colors.textMuted} strokeWidth={2} />
        <Text style={styles.trustNote}>Only used for what you ask below — never shared.</Text>
      </View>

      <View style={styles.photoButtonRow}>
        <Pressable
          style={styles.photoButton}
          onPress={() => handlePickImage("camera")}
          disabled={scanning}
        >
          <Camera size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.photoButtonText}>Take Photo</Text>
        </Pressable>
        <Pressable
          style={styles.photoButton}
          onPress={() => handlePickImage("library")}
          disabled={scanning}
        >
          <ImageIcon size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.photoButtonText}>Choose Photo</Text>
        </Pressable>
      </View>

      {photoUri ? (
        <View style={styles.photoPreviewRow}>
          <Image source={{ uri: photoUri }} style={styles.photoThumb} />
          {scanning ? (
            <View style={styles.scanningRow}>
              <BreathingDot size={18} />
              <Text style={styles.scanningText}>Reading document…</Text>
            </View>
          ) : (
            <Text style={styles.scanningText}>Text extracted below — check it over.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or paste text</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextField
        style={styles.textArea}
        placeholder="Paste document text here…"
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={10}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Practice a conversation about it"
        onPress={handleUseForScenario}
        loading={loading === "scenario"}
        disabled={loading === "explain" || scanning}
        style={styles.button}
      />
      <Button
        label="Just explain it to me"
        variant="secondary"
        onPress={handleExplainInstead}
        loading={loading === "explain"}
        disabled={loading === "scenario" || scanning}
        style={styles.button}
      />
      <Button
        label="Skip for now"
        variant="secondary"
        onPress={() => navigation.navigate("ScenarioSetup", undefined)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.h1, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  trustNoteRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xl },
  trustNote: { ...typography.caption, color: colors.textMuted },
  photoButtonRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.sm,
  },
  photoButtonText: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.primary },
  photoPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  photoThumb: { width: 48, height: 48, borderRadius: radius.input },
  scanningRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  scanningText: { ...typography.caption, color: colors.primaryDark, flex: 1 },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption },
  textArea: {
    minHeight: 180,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  button: { marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
