import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store/useAppStore";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

// Scoped to 3 for the hackathon demo to showcase the value clearly;
// more languages are a post-hackathon addition, not a technical limitation.
const COMMON_LANGUAGES = ["Spanish", "Mandarin", "Hindi", "Urdu"];

export function OnboardingScreen({ navigation }: Props) {
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useAppStore((s) => s.setProfile);

  async function handleContinue() {
    if (!nativeLanguage) {
      setError("Please choose your language.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.identify(nativeLanguage, "English");
      setProfile(nativeLanguage, "English");
      navigation.replace("Home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not connect. Check your internet and try again.");
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
        Practice real English conversations before they happen - using your native language as
        support whenever you get stuck.
      </Text>

      <Text style={styles.label}>Your native language</Text>
      <View style={styles.chipGrid}>
        {COMMON_LANGUAGES.map((lang) => (
          <Chip
            key={lang}
            label={lang}
            selected={nativeLanguage === lang}
            onPress={() => setNativeLanguage(lang)}
          />
        ))}
      </View>

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
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  button: { marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.md },
});
