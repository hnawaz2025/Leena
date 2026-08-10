import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Sprout } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { FadeInItem } from "../components/FadeInItem";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";
import { relativeDate } from "../utils/relativeDate";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { data: scenarios, isLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: api.listScenarios,
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
          data={scenarios ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon={Sprout}
              message="Nothing here yet — pick a real situation above and let's rehearse it together."
            />
          }
          renderItem={({ item, index }) => (
            <FadeInItem index={index}>
              <Pressable onPress={() => navigation.navigate("Conversation", { scenarioId: item.id })}>
                <Card
                  accentColor={item.latestStatus === "completed" ? colors.success : colors.primary}
                  style={styles.card}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardTextGroup}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {relativeDate(item.latestStartedAt)}
                        {item.attemptCount > 1 ? ` · Practice ${item.attemptCount}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.cardStatus}>
                      {item.latestStatus === "completed" ? "Done" : "In progress"}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            </FadeInItem>
          )}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  title: { ...typography.display, marginBottom: spacing.lg },
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
