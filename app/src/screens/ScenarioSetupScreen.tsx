import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";

type Props = NativeStackScreenProps<RootStackParamList, "ScenarioSetup">;

const SUGGESTIONS = [
  "Talking to my landlord about lease renewal",
  "DMV appointment for a driver's license",
  "First appointment with a new doctor",
  "Job interview for an entry-level role",
];

export function ScenarioSetupScreen({ route, navigation }: Props) {
  const documentId = route.params?.documentId;
  const documentType = route.params?.documentType;
  const [situationType, setSituationType] = useState(documentType ? "" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetLanguage = useAppStore((s) => s.targetLanguage);

  async function handleStart() {
    if (!situationType.trim()) {
      setError("Describe the situation you want to practice.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scenario = await api.createScenario(situationType.trim(), documentId);
      const session = await api.createSession(scenario.id);
      navigation.replace("Conversation", { sessionId: session.id, targetLanguage });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What are you preparing for?</Text>

      {documentId ? (
        <View style={styles.documentBadge}>
          <Text style={styles.documentBadgeText}>📄 Using your {documentType} document</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate("DocumentUpload")}>
          <Text style={styles.linkText}>+ Attach a document (lease, form, letter)</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.input}
        placeholder="e.g. Talking to my landlord about a lease renewal"
        value={situationType}
        onChangeText={setSituationType}
        multiline
      />

      <Text style={styles.suggestionsLabel}>Or pick a common one:</Text>
      {SUGGESTIONS.map((s) => (
        <TouchableOpacity key={s} style={styles.suggestion} onPress={() => setSituationType(s)}>
          <Text style={styles.suggestionText}>{s}</Text>
        </TouchableOpacity>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleStart} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start practicing</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  link: { marginBottom: 16 },
  linkText: { color: "#2f6fed", fontSize: 14, fontWeight: "600" },
  documentBadge: {
    backgroundColor: "#eef4ff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  documentBadgeText: { color: "#2f6fed", fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  suggestionsLabel: { fontSize: 13, color: "#888", marginBottom: 8 },
  suggestion: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionText: { fontSize: 14, color: "#333" },
  button: { backgroundColor: "#2f6fed", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", marginBottom: 12 },
});
