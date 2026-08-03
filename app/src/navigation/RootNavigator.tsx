import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ConversationScreen } from "../screens/ConversationScreen";
import { DocumentUploadScreen } from "../screens/DocumentUploadScreen";
import { FeedbackScreen } from "../screens/FeedbackScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { ScenarioSetupScreen } from "../screens/ScenarioSetupScreen";
import { colors, fontFamily } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: fontFamily.headingSemiBold, fontSize: 17 },
  headerBackTitle: "",
  contentStyle: { backgroundColor: colors.background },
};

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Onboarding" screenOptions={screenOptions}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Leena" }} />
      <Stack.Screen
        name="DocumentUpload"
        component={DocumentUploadScreen}
        options={{ title: "Add document" }}
      />
      <Stack.Screen
        name="ScenarioSetup"
        component={ScenarioSetupScreen}
        options={{ title: "New scenario" }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ title: "Practice conversation" }}
      />
      <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: "Feedback" }} />
    </Stack.Navigator>
  );
}
