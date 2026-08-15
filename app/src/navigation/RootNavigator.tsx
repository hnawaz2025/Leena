import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderHomeButton } from "../components/HeaderHomeButton";
import { ConversationScreen } from "../screens/ConversationScreen";
import { DocumentExplanationScreen } from "../screens/DocumentExplanationScreen";
import { DocumentUploadScreen } from "../screens/DocumentUploadScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { PhrasebookScreen } from "../screens/PhrasebookScreen";
import { ScenarioSetupScreen } from "../screens/ScenarioSetupScreen";
import { YourEnglishScreen } from "../screens/YourEnglishScreen";
import { colors, fontFamily } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fontFamily.headingSemiBold, fontSize: 17 },
        headerBackTitle: "",
        contentStyle: { backgroundColor: colors.background },
        // Every screen gets a one-tap way back to Home, since the default
        // back arrow only goes one screen back, not all the way home.
        headerRight: () => <HeaderHomeButton onPress={() => navigation.popToTop()} />,
      })}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Leena", headerRight: undefined }} />
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
      <Stack.Screen
        name="DocumentExplanation"
        component={DocumentExplanationScreen}
        options={{ title: "Explain document" }}
      />
      <Stack.Screen
        name="Phrasebook"
        component={PhrasebookScreen}
        options={{ title: "Your phrases" }}
      />
      <Stack.Screen
        name="YourEnglish"
        component={YourEnglishScreen}
        options={{ title: "Your English" }}
      />
    </Stack.Navigator>
  );
}
