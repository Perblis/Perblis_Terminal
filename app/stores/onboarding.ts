import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "../storage/mmkv";

type OnboardingState = {
  /** Seen the S1 onboarding (skippable after screen ①, FSD §6). */
  completed: boolean;
  /** First-launch map reveal plays exactly once (vision V7 ④). */
  mapRevealPlayed: boolean;
  complete: () => void;
  markMapRevealPlayed: () => void;
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      mapRevealPlayed: false,
      complete: () => set({ completed: true }),
      markMapRevealPlayed: () => set({ mapRevealPlayed: true }),
    }),
    { name: "terminal.onboarding", storage: createJSONStorage(() => zustandStorage) },
  ),
);
