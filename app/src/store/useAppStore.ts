import { create } from "zustand";

interface AppState {
  onboarded: boolean;
  nativeLanguage: string;
  targetLanguage: string;
  setProfile: (nativeLanguage: string, targetLanguage: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  onboarded: false,
  nativeLanguage: "",
  targetLanguage: "en",
  setProfile: (nativeLanguage, targetLanguage) =>
    set({ nativeLanguage, targetLanguage, onboarded: true }),
}));
