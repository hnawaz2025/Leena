import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Lora_500Medium, Lora_600SemiBold } from "@expo-google-fonts/lora";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAppStore } from "./src/store/useAppStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The default is three retries with exponential backoff, which against a
      // rate-limited server turns one 429 into four, and against the
      // half-minute analysis endpoint means a lot of pointless waiting. Retry
      // only what a retry can fix: 4xx means the request itself was wrong.
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unsupported on this platform. Never a reason to crash
  // before the app has even rendered.
});

export default function App() {
  // `fontError` is destructured deliberately. Dropping it meant a failed font
  // fetch left fontsLoaded false forever, so the app returned null behind a
  // splash screen that never hid -- a permanent blank screen with no error and
  // no recovery, on exactly the flaky conference wifi it's most likely to hit.
  const [fontsLoaded, fontError] = useFonts({
    Lora_500Medium,
    Lora_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Custom fonts are a nicety; the system ones are not. Rendering in Helvetica
  // beats not rendering at all.
  const fontsSettled = fontsLoaded || !!fontError;
  const ready = fontsSettled && hydrated;

  const onLayout = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Held until the saved profile is read, so a returning user never sees
  // onboarding flash before Home.
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <NavigationContainer>
            <View style={{ flex: 1 }} onLayout={onLayout}>
              <RootNavigator />
            </View>
            <StatusBar style="auto" />
          </NavigationContainer>
        </ErrorBoundary>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
