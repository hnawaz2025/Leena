import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ScenarioDTO } from "@leena/shared";
import { colors, radius, spacing, typography } from "../theme";

interface ScenarioInfoModalProps {
  visible: boolean;
  scenario: ScenarioDTO;
  onClose: () => void;
}

// Lets a returning user (opening a scenario days later, having forgotten the
// details) check exactly what they told the app, without digging back through
// Home/ScenarioSetup. It no longer fetches the document: there is no stored
// text to show.
export function ScenarioInfoModal({ visible, scenario, onClose }: ScenarioInfoModalProps) {
  const context = scenario.contextSummary;

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

            {scenario.documentId ? (
              <>
                <Text style={styles.sectionLabel}>Built from your document</Text>
                {/* The text itself isn't shown because it was never stored --
                    only that a document was used. */}
                <Text style={styles.sectionText}>
                  This conversation was based on a document you shared. We used it to write the
                  practice and did not keep a copy.
                </Text>
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
