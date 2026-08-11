import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import * as Speech from "expo-speech";
import { BookOpen, Volume2 } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PhraseEntryDTO } from "@leena/shared";
import { api } from "../api/client";
import { BreathingDot } from "../components/BreathingDot";
import { EmptyState } from "../components/EmptyState";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";
import { relativeDate } from "../utils/relativeDate";

type Props = NativeStackScreenProps<RootStackParamList, "Phrasebook">;

function PhraseRow({ phrase }: { phrase: PhraseEntryDTO }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => Speech.speak(phrase.suggestedText, { language: "en-US" })}
    >
      <View style={styles.rowTextGroup}>
        <Text style={styles.phrase}>{phrase.suggestedText}</Text>
        <Text style={styles.meta}>
          {phrase.mastered
            ? `last needed ${relativeDate(phrase.lastLookedUpAt)}`
            : `looked up ${phrase.lookupCount}×`}
        </Text>
      </View>
      <Volume2 size={18} color={colors.primary} strokeWidth={2} />
    </Pressable>
  );
}

// Everything the user has ever asked how to say, deduplicated by phrase. The
// two groups are the point: "you've got these" is evidence of progress, which
// is what actually reduces anxiety, and it's only visible because repeats
// collapse instead of piling up as a log.
export function PhrasebookScreen({}: Props) {
  const { data: phrases, isLoading } = useQuery({
    queryKey: ["phrases"],
    queryFn: api.listPhrases,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <BreathingDot size={24} />
      </View>
    );
  }

  const mastered = phrases?.filter((p) => p.mastered) ?? [];
  const learning = phrases?.filter((p) => !p.mastered) ?? [];

  if (!phrases?.length) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon={BookOpen}
          message="Nothing yet — every time you ask how to say something, it lands here."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {learning.length ? (
        <>
          <Text style={styles.sectionTitle}>Still learning · {learning.length}</Text>
          {learning.map((p) => (
            <PhraseRow key={p.keyPhrase} phrase={p} />
          ))}
        </>
      ) : null}

      {mastered.length ? (
        <>
          <Text style={styles.sectionTitle}>You've got these · {mastered.length}</Text>
          {mastered.map((p) => (
            <PhraseRow key={p.keyPhrase} phrase={p} />
          ))}
        </>
      ) : null}
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
  sectionTitle: {
    ...typography.h2,
    fontSize: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
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
