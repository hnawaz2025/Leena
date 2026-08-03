import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { TextField } from "../components/TextField";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const COMMON_LANGUAGES = [
  "Spanish",
  "Mandarin",
  "Hindi",
  "Arabic",
  "Portuguese",
  "Vietnamese",
  "Tagalog",
  "Korean",
  "Russian",
  "French",
];

export function OnboardingScreen({ navigation }: Props) {
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customLanguage, setCustomLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useAppStore((s) => s.setProfile);

  const selectedLanguage = showOtherInput ? customLanguage.trim() : nativeLanguage;

  async function handleContinue() {
    if (!selectedLanguage) {
      setError("Tell us your native language first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.identify(selectedLanguage, "English");
      setProfile(selectedLanguage, "English");
      navigation.replace("Home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={require("../../assets/splash-icon.png")}
        style={styles.heroIcon}
        resizeMode="contain"
      />
      <Text style={styles.title}>Welcome to Leena</Text>
      <Text style={styles.subtitle}>
        Practice real conversations before they happen — in your own language first. No one is
        judging your English here.
      </Text>

      <Text style={styles.label}>Your native language</Text>
      <View style={styles.chipGrid}>
        {COMMON_LANGUAGES.map((lang) => (
          <Chip
            key={lang}
            label={lang}
            selected={!showOtherInput && nativeLanguage === lang}
            onPress={() => {
              setShowOtherInput(false);
              setNativeLanguage(lang);
            }}
          />
        ))}
        <Chip label="Other" selected={showOtherInput} onPress={() => setShowOtherInput(true)} />
      </View>

      {showOtherInput ? (
        <TextField
          style={styles.customInput}
          placeholder="Type your native language"
          value={customLanguage}
          onChangeText={setCustomLanguage}
        />
      ) : null}

      <Text style={styles.note}>You'll be practicing: English</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Continue" onPress={handleContinue} loading={loading} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: "center", backgroundColor: colors.background },
  heroIcon: { width: 88, height: 88, alignSelf: "center", marginBottom: spacing.md },
  title: { ...typography.display, marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl, textAlign: "center" },
  label: { ...typography.caption, fontFamily: typography.bodyBold.fontFamily, color: colors.textPrimary, marginBottom: spacing.md },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  customInput: { marginBottom: spacing.lg },
  note: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl },
  button: { marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
