import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ScenarioDTO } from "@leena/shared";
import { api } from "../api/client";
import { colors, radius, spacing, typography } from "../theme";
import { BreathingDot } from "./BreathingDot";

interface ScenarioInfoModalProps {
  visible: boolean;
  scenario: ScenarioDTO;
  onClose: () => void;
}

// Lets a returning user (opening a scenario days later, having forgotten the
// details) check exactly what they told the app and what document they
// attached, without digging back through Home/ScenarioSetup.
export function ScenarioInfoModal({ visible, scenario, onClose }: ScenarioInfoModalProps) {
  const { data: document, isLoading: documentLoading } = useQuery({
    queryKey: ["document", scenario.documentId],
    queryFn: () => api.getDocument(scenario.documentId!),
    enabled: visible && !!scenario.documentId,
  });

  // contextSummary is stored with an "Opening line" / "Key vocabulary"
  // appendix (see scenarios.ts) that helps the AI stay in character -- useful
  // for chatTurn, but not something the immigrant actually provided, so it's
  // stripped here for display.
  const context = scenario.contextSummary.split(/\n\nOpening line:/)[0];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {scenario.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textSecondary} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {scenario.situationType ? (
              <>
                <Text style={styles.sectionLabel}>What you told us</Text>
                <Text style={styles.sectionText}>{scenario.situationType}</Text>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>Context for this conversation</Text>
            <Text style={styles.sectionText}>{context}</Text>

            {scenario.documentId && (documentLoading || document?.extractedText) ? (
              <>
                <Text style={styles.sectionLabel}>Document you provided</Text>
                {documentLoading ? (
                  <BreathingDot size={16} />
                ) : (
                  <Text style={styles.sectionText}>{document!.extractedText}</Text>
                )}
              </>
            ) : null}
          </ScrollView>
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
    maxHeight: "80%",
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h2, flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  sectionLabel: {
    ...typography.caption,
    fontFamily: typography.bodyBold.fontFamily,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionText: { ...typography.body },
});
