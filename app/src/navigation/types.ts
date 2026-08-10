export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  DocumentUpload: undefined;
  ScenarioSetup: { documentId?: string } | undefined;
  Conversation: { scenarioId: string };
  DocumentExplanation: { documentId: string; documentType: string };
};
