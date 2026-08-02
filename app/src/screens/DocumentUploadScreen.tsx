import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "DocumentUpload">;

const DOCUMENT_TYPES = ["lease", "medical", "job-letter", "other"] as const;

// MVP: the user pastes the document text directly. Camera capture + on-device
// OCR is planned for the document-upload milestone; this screen already
// produces the same downstream shape (a Document row with extractedText) so
// swapping in OCR later doesn't change anything past this screen.
export function DocumentUploadScreen({ navigation }: Props) {
  const [type, setType] = useState<(typeof DOCUMENT_TYPES)[number]>("lease");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!text.trim()) {
      setError("Paste the document text first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const document = await api.createDocument(type, text.trim());
      navigation.navigate("ScenarioSetup", { documentId: document.id, documentType: type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add a document</Text>
      <Text style={styles.subtitle}>
        Paste the text of a lease, form, or letter. Leena will build a practice conversation around it.
      </Text>

      <View style={styles.typeRow}>
        {DOCUMENT_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, type === t && styles.typeChipActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.textArea}
        placeholder="Paste document text here…"
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={10}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Use this document</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 20 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  typeChipActive: { backgroundColor: "#2f6fed", borderColor: "#2f6fed" },
  typeChipText: { color: "#333", fontSize: 13 },
  typeChipTextActive: { color: "#fff" },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 180,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  button: { backgroundColor: "#2f6fed", borderRadius: 10, padding: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", marginBottom: 12 },
});
