import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.listSessions,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your practice sessions</Text>

      <TouchableOpacity
        style={styles.newButton}
        onPress={() => navigation.navigate("ScenarioSetup", undefined)}
      >
        <Text style={styles.newButtonText}>+ New scenario</Text>
      </TouchableOpacity>

      {isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : (
        <FlatList
          data={sessions ?? []}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No sessions yet. Start your first scenario above.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                item.status === "completed"
                  ? navigation.navigate("Feedback", { sessionId: item.id })
                  : navigation.navigate("Conversation", { sessionId: item.id, targetLanguage: "en" })
              }
            >
              <Text style={styles.rowTitle}>Session {item.id.slice(0, 8)}</Text>
              <Text style={styles.rowStatus}>{item.status}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  newButton: {
    backgroundColor: "#2f6fed",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 24,
  },
  newButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  empty: { color: "#888", textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  rowStatus: { fontSize: 13, color: "#888" },
});
