import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { BookOpen, Volume2 } from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PhraseEntryDTO } from "@leena/shared";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { EmptyState } from "../components/EmptyState";
import { SwipeableRow } from "../components/SwipeableRow";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Phrasebook">;

function PhraseRow({
  phrase,
  onDelete,
  onPractice,
}: {
  phrase: PhraseEntryDTO;
  onDelete: () => void;
  onPractice: () => void;
}) {
  return (
    <SwipeableRow onDelete={onDelete} bottomInset={spacing.sm}>
      <Pressable
        style={styles.row}
        onPress={() => {
          Speech.speak(phrase.suggestedText, { language: "en-US" });
          onPractice();
        }}
      >
        <View style={styles.rowTextGroup}>
          <Text style={styles.phrase}>{phrase.suggestedText}</Text>
          {phrase.practiceCount > 0 ? (
            <Text style={styles.meta}>practiced {phrase.practiceCount}×</Text>
          ) : null}
        </View>
        <Volume2 size={18} color={colors.primary} strokeWidth={2} />
      </Pressable>
    </SwipeableRow>
  );
}

// Everything the user has ever asked how to say, deduplicated by phrase and
// sorted by how often they've needed it. No "mastered" split -- a permanent
// mastery checkmark can't honestly describe how memory actually works, so
// this is just a flat list with a practice count for the phrases someone
// chooses to say aloud.
export function PhrasebookScreen({}: Props) {
  const queryClient = useQueryClient();
  const { data: phrases, isLoading } = useQuery({
    queryKey: ["phrases"],
    queryFn: api.listPhrases,
  });

  const deletePhrase = useMutation({
    mutationFn: api.deletePhrase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phrases"] }),
  });

  const practicePhrase = useMutation({
    mutationFn: api.logPhrasePractice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["phrases"] }),
  });

  // Deleting a phrase removes every lookup behind it, not just the row -- so
  // the count and history go too. Worth confirming for something the user
  // cannot recover.
  function confirmDelete(keyPhrase: string, shown: string) {
    Alert.alert(
      "Delete this phrase?",
      `You will lose "${shown}" and the times you practised it. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deletePhrase.mutate(keyPhrase) },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <BreathingDot size={24} />
      </View>
    );
  }

  if (!phrases?.length) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={BookOpen}
          message="No phrases yet. Every time you ask how to say something, we save it here for you."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {phrases.map((p) => (
        <PhraseRow
          key={p.keyPhrase}
          phrase={p}
          onDelete={() => confirmDelete(p.keyPhrase, p.suggestedText)}
          onPractice={() => practicePhrase.mutate(p.keyPhrase)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowTextGroup: { flex: 1 },
  phrase: { ...typography.body, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
});
