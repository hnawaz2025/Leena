import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export function OnboardingScreen({ navigation }: Props) {
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useAppStore((s) => s.setProfile);

  async function handleContinue() {
    if (!nativeLanguage.trim()) {
      setError("Tell us your native language first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.identify(nativeLanguage.trim(), targetLanguage.trim() || "en");
      setProfile(nativeLanguage.trim(), targetLanguage.trim() || "en");
      navigation.replace("Home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Leena</Text>
      <Text style={styles.subtitle}>
        Practice real conversations before they happen — in your own language first.
      </Text>

      <Text style={styles.label}>Your native language</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Spanish, Hindi, Mandarin"
        value={nativeLanguage}
        onChangeText={setNativeLanguage}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Language you want to practice</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. English"
        value={targetLanguage}
        onChangeText={setTargetLanguage}
        autoCapitalize="none"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 32 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2f6fed",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", marginBottom: 12 },
});
