import { create } from "zustand";
import { getItem, setItem } from "../api/storage";

const PROFILE_KEY = "leena_profile";

interface AppState {
  /** False until the stored profile has been read. Nothing should route on
   *  `onboarded` before this flips, or a returning user flashes onboarding. */
  hydrated: boolean;
  onboarded: boolean;
  nativeLanguage: string;
  targetLanguage: string;
  hydrate: () => Promise<void>;
  setProfile: (nativeLanguage: string, targetLanguage: string) => void;
}

// The profile lives on the device, not just in memory.
//
// It used to be memory-only, so every cold start sent the user back through
// onboarding to re-answer a question they had already answered -- even though
// their auth token was persisted and the server still held all their history.
// Pure friction, and the first thing anyone opening the app twice would hit.
export const useAppStore = create<AppState>((set) => ({
  hydrated: false,
  onboarded: false,
  nativeLanguage: "",
  targetLanguage: "English",

  // Never rejects. A storage read failing is not a reason to block someone
  // from the app -- the worst case is they see onboarding once more, which is
  // exactly the old behaviour.
  hydrate: async () => {
    try {
      const raw = await getItem(PROFILE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { nativeLanguage?: string; targetLanguage?: string };
        if (saved.nativeLanguage) {
          set({
            onboarded: true,
            nativeLanguage: saved.nativeLanguage,
            targetLanguage: saved.targetLanguage ?? "English",
          });
        }
      }
    } catch (error) {
      console.warn("Could not read the saved profile:", error);
    } finally {
      set({ hydrated: true });
    }
  },

  setProfile: (nativeLanguage, targetLanguage) => {
    set({ nativeLanguage, targetLanguage, onboarded: true });
    // Fire-and-forget: the state is already updated, so a slow or failed
    // write must not hold up navigation into the app.
    void setItem(PROFILE_KEY, JSON.stringify({ nativeLanguage, targetLanguage })).catch((error) =>
      console.warn("Could not save the profile:", error)
    );
  },
}));
