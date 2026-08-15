import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Sprout } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api/client";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { FadeInItem } from "../components/FadeInItem";
import { BreathingDot } from "../components/BreathingDot";
import { MetricStrip } from "../components/MetricStrip";
import { MicButton } from "../components/MicButton";
import { QuickLookupSheet } from "../components/QuickLookupSheet";
import { RotatingPlaceholder } from "../components/RotatingPlaceholder";
import { SwipeableRow } from "../components/SwipeableRow";
import { TextField } from "../components/TextField";
import { useDocumentCapture } from "../hooks/useDocumentCapture";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, radius, spacing, typography } from "../theme";
import { getQuickLookupExamples, toLanguageCode } from "../utils/languageCodes";
import { relativeDate } from "../utils/relativeDate";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

// Home leads with the fast path, not the deliberate one. Most moments people
// need help with are spontaneous -- can't read a menu, want to ask a question
// in class -- and the scenario setup flow is far too slow for those. So the
// quick lookup is the always-present bottom input, and rehearsing a full
// conversation is a separate, clearly-labelled action.
export function HomeScreen({ navigation }: Props) {
  const [lookupText, setLookupText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);
  const voice = useVoiceRecording();
  const { capture, scanning, error: captureError } = useDocumentCapture();

  const { data: scenarios, isLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: api.listScenarios,
  });

  const { data: phrases } = useQuery({ queryKey: ["phrases"], queryFn: api.listPhrases });
  const { data: metrics } = useQuery({ queryKey: ["metrics"], queryFn: api.getMetrics });

  const queryClient = useQueryClient();
  const deleteScenario = useMutation({
    mutationFn: api.deleteScenario,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scenarios"] }),
  });

  function submitLookup(text: string) {
    if (!text.trim()) return;
    setSubmittedText(text.trim());
    setLookupText("");
    setSheetOpen(true);
  }

  // Straight from photo to plain-language explanation, skipping the
  // review/edit step DocumentUploadScreen shows. Someone holding up a letter
  // they can't read wants the answer, not a text box; a bad OCR is fixed by
  // retaking the photo.
  async function handleCameraPress() {
    setCameraError(null);
    const captured = await capture("camera");
    if (!captured) return;
    try {
      const document = await api.createDocument("other", captured.text);
      navigation.navigate("DocumentExplanation", { documentId: document.id, documentType: "other" });
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function handleMicPress() {
    if (voice.state === "idle") {
      await voice.startRecording();
    } else if (voice.state === "recording") {
      const text = await voice.stopRecordingAndTranscribe(toLanguageCode(nativeLanguage));
      // Speaking is the whole point of the fast path, so a finished recording
      // goes straight to an answer rather than waiting for a second tap.
      if (text) submitLookup(text);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        {metrics?.ready && (metrics.independence || metrics.recovery || metrics.coverage) ? (
          <MetricStrip
            metrics={[
              ...(metrics.independence
                ? [{ label: "Independence", metric: metrics.independence }]
                : []),
              ...(metrics.recovery ? [{ label: "Recovery", metric: metrics.recovery }] : []),
              ...(metrics.coverage ? [{ label: "Coverage", metric: metrics.coverage }] : []),
            ]}
            onPress={() => navigation.navigate("YourEnglish")}
          />
        ) : null}

        <Text style={styles.sectionLabel}>Your practice</Text>

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
                message="Nothing here yet — ask me how to say something below, or rehearse a whole conversation."
              />
            }
            renderItem={({ item, index }) => (
              <FadeInItem index={index}>
                <SwipeableRow onDelete={() => deleteScenario.mutate(item.id)}>
                  <Pressable
                    onPress={() => navigation.navigate("Conversation", { scenarioId: item.id })}
                  >
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
                          {item.checklistTotal > 0
                            ? `${item.checklistCovered} / ${item.checklistTotal}`
                            : item.latestStatus === "completed"
                              ? "Done"
                              : "In progress"}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                </SwipeableRow>
              </FadeInItem>
            )}
            onEndReachedThreshold={0.5}
          />
        )}
      </View>

      <View style={styles.linkRow}>
        <Pressable
          style={styles.rehearseButton}
          onPress={() => navigation.navigate("ScenarioSetup", undefined)}
        >
          <Text style={styles.rehearseText}>Rehearse a conversation</Text>
          <ArrowRight size={14} color={colors.primary} strokeWidth={2.5} />
        </Pressable>

        {phrases?.length ? (
          <Pressable style={styles.rehearseButton} onPress={() => navigation.navigate("Phrasebook")}>
            <Text style={styles.rehearseText}>
              Your phrases · {phrases.filter((p) => p.mastered).length}/{phrases.length}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {(voice.error || captureError || cameraError) ? (
        <Text style={styles.error}>{voice.error || captureError || cameraError}</Text>
      ) : null}
      {voice.state === "recording" ? <Text style={styles.listeningNote}>Listening…</Text> : null}
      {scanning ? (
        <View style={styles.scanningRow}>
          <BreathingDot size={16} />
          <Text style={styles.scanningText}>Reading document…</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <Pressable style={styles.cameraButton} onPress={handleCameraPress} disabled={scanning}>
          <Camera size={20} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
        <View style={styles.input}>
          <TextField
            placeholder=""
            value={lookupText}
            onChangeText={setLookupText}
            onSubmitEditing={() => submitLookup(lookupText)}
            returnKeyType="send"
          />
          <RotatingPlaceholder
            phrases={getQuickLookupExamples(nativeLanguage)}
            visible={!lookupText}
          />
        </View>
        <MicButton state={voice.state} onPress={handleMicPress} />
      </View>

      <QuickLookupSheet
        visible={sheetOpen}
        nativeLanguageText={submittedText}
        nativeLanguage={nativeLanguage}
        onClose={() => setSheetOpen(false)}
        onPracticeThis={(englishText) => {
          setSheetOpen(false);
          navigation.navigate("ScenarioSetup", { prefillEnglish: englishText });
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  sectionLabel: {
    ...typography.caption,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  loading: { ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xxxl },
  list: { paddingBottom: spacing.xl, gap: spacing.md },
  card: { marginBottom: spacing.md },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTextGroup: { flex: 1, marginRight: spacing.md },
  cardTitle: { ...typography.h2, fontSize: 16, marginBottom: spacing.xs },
  cardMeta: { ...typography.caption },
  cardStatus: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textSecondary },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
  },
  rehearseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  rehearseText: { ...typography.caption, color: colors.primary, fontFamily: typography.bodyBold.fontFamily },
  listeningNote: {
    ...typography.caption,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  error: { ...typography.caption, color: colors.error, textAlign: "center", marginBottom: spacing.xs },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  scanningText: { ...typography.caption, color: colors.primaryDark },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  input: { flex: 1 },
});
