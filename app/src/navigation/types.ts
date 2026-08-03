export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  DocumentUpload: undefined;
  ScenarioSetup: { documentId?: string; documentType?: string } | undefined;
  Conversation: { sessionId: string; targetLanguage: string; scenarioId: string };
  Feedback: { sessionId: string; scenarioId: string };
};
