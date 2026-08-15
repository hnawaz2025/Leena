export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  DocumentUpload: undefined;
  ScenarioSetup: { documentId?: string; prefillEnglish?: string } | undefined;
  Conversation: { scenarioId: string };
  DocumentExplanation: { documentId: string; documentType: string };
  Phrasebook: undefined;
  YourEnglish: undefined;
};
