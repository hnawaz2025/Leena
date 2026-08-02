import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";

const DEVICE_ID_KEY = "leena_device_id";
const AUTH_TOKEN_KEY = "leena_auth_token";

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

// Minted by the server on POST /users/identify and required on every
// subsequent authenticated request (see server/src/middleware/deviceAuth.ts)
// so that knowing/guessing a deviceId alone isn't enough to act as that user.
export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}
