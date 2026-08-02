import { getAuthToken, getOrCreateDeviceId, setAuthToken } from "./deviceId";

// Point this at your local server IP (not "localhost") when testing on a
// physical device via Expo Go, e.g. http://192.168.1.23:4000
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
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

  createScenario: (situationType: string, documentId?: string) =>
    request<import("@leena/shared").ScenarioDTO>("/scenarios", {
      method: "POST",
      body: JSON.stringify({ situationType, documentId }),
    }),

  listSessions: () => request<import("@leena/shared").SessionDTO[]>("/sessions"),

  createSession: (scenarioId: string) =>
    request<import("@leena/shared").SessionDTO>("/sessions", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    }),

  listTurns: (sessionId: string) =>
    request<import("@leena/shared").TurnDTO[]>(`/sessions/${sessionId}/turns`),

  sendTurn: (sessionId: string, text: string, language: string) =>
    request<{
      userTurn: import("@leena/shared").TurnDTO;
      agentTurn: import("@leena/shared").TurnDTO;
    }>(`/sessions/${sessionId}/turns`, {
      method: "POST",
      body: JSON.stringify({ text, language }),
    }),

  endSession: (sessionId: string) =>
    request<import("@leena/shared").SessionDTO>(`/sessions/${sessionId}/end`, { method: "POST" }),

  getFeedback: (sessionId: string) =>
    request<import("@leena/shared").FeedbackReportDTO>(`/sessions/${sessionId}/feedback`),
};
