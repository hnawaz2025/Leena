import * as Speech from "expo-speech";
import { ArrowRight, Check, Volume2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { colors, radius, spacing, typography } from "../theme";
import { BreathingDot } from "./BreathingDot";

interface QuickLookupSheetProps {
  visible: boolean;
  nativeLanguageText: string;
  nativeLanguage: string;
  onClose: () => void;
  onPracticeThis: (englishText: string) => void;
}

// The payoff for the Home screen's fast path: someone standing at a counter
// gets English they can say out loud in about ten seconds. No session, no
// roleplay, no feedback report -- and "Practice this" is always offered, so
// we never have to guess whether they wanted a lookup or a rehearsal.
export function QuickLookupSheet({
  visible,
  nativeLanguageText,
  nativeLanguage,
  onClose,
  onPracticeThis,
}: QuickLookupSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; suggestedText: string } | null>(null);

  useEffect(() => {
    if (!visible || !nativeLanguageText.trim()) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);

    api
      .requestHelpPhrase(nativeLanguageText.trim(), nativeLanguage)
      .then((r) => {
        if (cancelled) return;
        setResult({ eventId: r.id, suggestedText: r.suggestedText });
        // Speak it immediately -- hearing it is the point, and someone
        // mid-situation shouldn't need a second tap to get there.
        Speech.speak(r.suggestedText, { language: "en-US" });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, nativeLanguageText, nativeLanguage]);

  function handleClose() {
    Speech.stop();
    onClose();
  }

  async function handleSaidIt() {
    if (result) {
      try {
        await api.markHelpPhraseUsed(result.eventId);
      } catch {
        // Usage tracking only -- never block the user on it.
      }
    }
    handleClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.youSaid} numberOfLines={2}>
              {nativeLanguageText}
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <X size={20} color={colors.textSecondary} strokeWidth={2.5} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <BreathingDot size={24} />
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : result ? (
            <>
              <View style={styles.answerRow}>
                <Text style={styles.answer}>{result.suggestedText}</Text>
                <Pressable
                  onPress={() => Speech.speak(result.suggestedText, { language: "en-US" })}
                  hitSlop={8}
                >
                  <Volume2 size={22} color={colors.primary} strokeWidth={2} />
                </Pressable>
              </View>

              <Pressable style={styles.saidItButton} onPress={handleSaidIt}>
                <Check size={16} color={colors.white} strokeWidth={2.5} />
                <Text style={styles.saidItText}>I said it</Text>
              </Pressable>

              <Pressable
                style={styles.practiceButton}
                onPress={() => {
                  Speech.stop();
                  onPracticeThis(result.suggestedText);
                }}
              >
                <Text style={styles.practiceText}>Practice a conversation like this</Text>
                <ArrowRight size={14} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(32, 28, 43, 0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  youSaid: { ...typography.caption, flex: 1, fontStyle: "italic" },
  center: { alignItems: "center", paddingVertical: spacing.xl },
  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  answer: { ...typography.h2, fontSize: 18, flex: 1 },
  saidItButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
  },
  saidItText: { ...typography.button, color: colors.white },
  practiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  practiceText: { ...typography.caption, color: colors.primary, fontFamily: typography.bodyBold.fontFamily },
  error: { ...typography.caption, color: colors.error, paddingVertical: spacing.lg },
});
