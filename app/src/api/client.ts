import { getAuthToken, getOrCreateDeviceId, setAuthToken } from "./deviceId";

// Point this at your local server IP (not "localhost") when testing on a
// physical device via Expo Go, e.g. http://192.168.1.23:4000
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Whatever this returns is what the user reads. The server already decides
// what is safe and sensible to show (see server/src/errors.ts), so the job
// here is to surface that message rather than wrap it in HTTP noise --
// stringifying the whole response is how "500 Internal Server Error:
// {"error":"...GLM-4-9B-0414 is temporarily at capacity"}" ended up on screen.
async function errorMessageFrom(response: Response): Promise<string> {
  const fallback = "Something went wrong. Please try again.";
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    // Zod's flatten() shape -- surface the first field error, which is the
    // only part a person can act on.
    const fieldErrors = body?.error?.fieldErrors as Record<string, string[]> | undefined;
    const firstField = fieldErrors && Object.values(fieldErrors).flat()[0];
    if (typeof firstField === "string") return firstField;
    const formErrors = body?.error?.formErrors as string[] | undefined;
    if (formErrors?.length) return formErrors[0];
    return fallback;
  } catch {
    // Non-JSON body: a proxy error page, or the server being unreachable.
    return response.status >= 500
      ? "The server isn't responding right now. Please try again."
      : fallback;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const deviceId = await getOrCreateDeviceId();
  const authToken = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-device-id": deviceId,
      ...(authToken ? { "x-auth-token": authToken } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await errorMessageFrom(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  identify: async (nativeLanguage: string, targetLanguage: string) => {
    const deviceId = await getOrCreateDeviceId();
    const result = await request<{
      id: string;
      authToken: string;
      nativeLanguage: string;
      targetLanguage: string;
    }>("/users/identify", {
      method: "POST",
      body: JSON.stringify({ deviceId, nativeLanguage, targetLanguage }),
    });
    await setAuthToken(result.authToken);
    return result;
  },

  createDocument: (type: string, extractedText: string) =>
    request<{ id: string; type: string }>("/documents", {
      method: "POST",
      body: JSON.stringify({ type, extractedText }),
    }),

  explainDocument: (documentId: string) =>
    request<import("@leena/shared").DocumentExplanationDTO>(`/documents/${documentId}/explain`, {
      method: "POST",
    }),

  extractDocumentImage: (imageBase64: string, mimeType: string) =>
    request<{ text: string }>("/documents/extract-from-image", {
      method: "POST",
      body: JSON.stringify({ image: imageBase64, mimeType }),
    }),

  createScenario: (situationType: string, documentId?: string) =>
    request<import("@leena/shared").ScenarioDTO>("/scenarios", {
      method: "POST",
      body: JSON.stringify({ situationType, documentId }),
    }),

  getScenario: (scenarioId: string) =>
    request<import("@leena/shared").ScenarioDTO>(`/scenarios/${scenarioId}`),

  createSession: (scenarioId: string) =>
    request<import("@leena/shared").SessionDTO>("/sessions", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    }),

  listTurns: (sessionId: string) =>
    request<import("@leena/shared").TurnDTO[]>(`/sessions/${sessionId}/turns`),

  // fromSuggestion marks text that came out of the help panel, so metrics can
  // tell "you said this yourself" from "the app wrote this for you" even when
  // the user edited it before sending.
  sendTurn: (sessionId: string, text: string, language: string, fromSuggestion = false) =>
    request<{
      userTurn: import("@leena/shared").TurnDTO;
      agentTurn: import("@leena/shared").TurnDTO;
    }>(`/sessions/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify({ text, language, fromSuggestion }),
    }),

  endSession: (sessionId: string) =>
    request<import("@leena/shared").SessionDTO>(`/sessions/${sessionId}/end`, { method: "POST" }),

  getFeedback: (sessionId: string) =>
    request<import("@leena/shared").FeedbackReportDTO>(`/sessions/${sessionId}/feedback`),

  transcribe: (audioBase64: string, mimeType: string, language?: string) =>
    request<{ text: string }>("/speech/transcribe", {
      method: "POST",
      body: JSON.stringify({ audio: audioBase64, mimeType, language }),
    }),

  // sessionId is omitted for a standalone quick lookup -- the suggestion is
  // then generated without any roleplay context.
  requestHelpPhrase: (nativeLanguageText: string, nativeLanguage: string, sessionId?: string) =>
    request<import("@leena/shared").HelpSuggestionDTO>("/help", {
      method: "POST",
      body: JSON.stringify({ nativeLanguageText, nativeLanguage, sessionId }),
    }),

  markHelpPhraseUsed: (eventId: string) =>
    request<void>(`/help/${eventId}/use`, { method: "POST" }),

  getMetrics: () => request<import("@leena/shared").MetricsDTO>("/metrics"),

  listPhrases: () => request<import("@leena/shared").PhraseEntryDTO[]>("/help/phrases"),

  deletePhrase: (keyPhrase: string) =>
    request<void>(`/help/phrases?keyPhrase=${encodeURIComponent(keyPhrase)}`, {
      method: "DELETE",
    }),

  logPhrasePractice: (keyPhrase: string) =>
    request<void>("/help/phrases/practice", {
      method: "POST",
      body: JSON.stringify({ keyPhrase }),
    }),

  listScenarios: () => request<import("@leena/shared").ScenarioListItemDTO[]>("/scenarios"),

  deleteScenario: (scenarioId: string) =>
    request<void>(`/scenarios/${scenarioId}`, { method: "DELETE" }),

  listScenarioSessions: (scenarioId: string) =>
    request<import("@leena/shared").ScenarioSessionSummaryDTO[]>(`/scenarios/${scenarioId}/sessions`),

  getDocument: (documentId: string) =>
    request<import("@leena/shared").DocumentDTO>(`/documents/${documentId}`),
};
