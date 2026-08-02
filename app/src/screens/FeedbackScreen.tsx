import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { RootStackParamList } from "../navigation/types";
import { api } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Feedback">;

export function FeedbackScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;

  const { data: feedback, isLoading, error } = useQuery({
    queryKey: ["feedback", sessionId],
    queryFn: () => api.getFeedback(sessionId),
    retry: 3,
    retryDelay: 1500,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2f6fed" />
        <Text style={styles.loadingText}>Analyzing your conversation…</Text>
      </View>
    );
  }

  if (error || !feedback) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Feedback isn't ready yet. Pull to try again shortly.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>How you did</Text>
      <Text style={styles.summary}>{feedback.summary}</Text>

      <Text style={styles.sectionTitle}>Where you struggled</Text>
      {feedback.struggleAreas.map((area, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.itemText}>• {area}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Vocabulary to learn</Text>
      {feedback.vocabularySuggestions.map((v, i) => (
        <View key={i} style={styles.vocabItem}>
          <Text style={styles.vocabTerm}>{v.term}</Text>
          <Text style={styles.vocabNote}>{v.note}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={() => navigation.popToTop()}>
        <Text style={styles.buttonText}>Back to home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 16, color: "#555", textAlign: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  summary: { fontSize: 15, color: "#333", marginBottom: 24, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 10 },
  item: { marginBottom: 6 },
  itemText: { fontSize: 14, color: "#444" },
  vocabItem: {
    backgroundColor: "#f7f8fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  vocabTerm: { fontWeight: "700", fontSize: 14, marginBottom: 2 },
  vocabNote: { fontSize: 13, color: "#555" },
  button: {
    backgroundColor: "#2f6fed",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
