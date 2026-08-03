import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function HomeScreen({ navigation }: Props) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.listSessions,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ready to practice?</Text>
      <Button
        label="+ New scenario"
        onPress={() => navigation.navigate("ScenarioSetup", undefined)}
        style={styles.newButton}
      />

      <Text style={styles.sectionLabel}>Your past practice</Text>

      {isLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : (
        <FlatList
          data={sessions ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="🌱"
              message="Nothing here yet — pick a real situation above and let's rehearse it together."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                item.status === "completed"
                  ? navigation.navigate("Feedback", { sessionId: item.id, scenarioId: item.scenarioId })
                  : navigation.navigate("Conversation", {
                      sessionId: item.id,
                      targetLanguage: "English",
                      scenarioId: item.scenarioId,
                    })
              }
            >
              <Card
                accentColor={item.status === "completed" ? colors.secondary : colors.primary}
                style={styles.card}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardTextGroup}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.scenarioTitle}
                    </Text>
                    <Text style={styles.cardMeta}>{relativeDate(item.startedAt)}</Text>
                  </View>
                  <Text style={styles.cardStatus}>
                    {item.status === "completed" ? "Done" : "In progress"}
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.h1, marginBottom: spacing.lg },
  newButton: { marginBottom: spacing.xxl },
  sectionLabel: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textSecondary, marginBottom: spacing.md },
  loading: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xxxl },
  list: { paddingBottom: spacing.xl, gap: spacing.md },
  card: { marginBottom: spacing.md },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTextGroup: { flex: 1, marginRight: spacing.md },
  cardTitle: { ...typography.h2, fontSize: 16, marginBottom: spacing.xs },
  cardMeta: { ...typography.caption },
  cardStatus: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textSecondary },
});
