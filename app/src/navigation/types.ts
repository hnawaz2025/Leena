export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  DocumentUpload: undefined;
  // documentText rides along because the server stores none -- see the
  // Document model. It exists only for the length of these screens.
  ScenarioSetup: { documentId?: string; documentText?: string; prefillEnglish?: string } | undefined;
  Conversation: { scenarioId: string };
  DocumentExplanation: { documentId: string; documentType: string; text: string };
  Phrasebook: undefined;
  YourEnglish: undefined;
};
