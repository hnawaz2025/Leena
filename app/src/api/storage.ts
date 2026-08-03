import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// expo-secure-store has no web implementation (it wraps native iOS/Android
// keychain APIs), which throws when this app renders via react-native-web
// (e.g. in-editor Mobile Preview, or a browser). Fall back to localStorage
// there; real devices keep using SecureStore.
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
