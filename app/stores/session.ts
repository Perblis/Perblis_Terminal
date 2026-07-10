import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Me } from "../lib/types";
import { zustandStorage } from "../storage/mmkv";

type SessionState = {
  /** null = guest (FSD §6 guest posture). Populated after login/refresh. */
  me: Me | null;
  /** True once the stored refresh token has been checked on cold start. */
  hydrated: boolean;
  setMe: (me: Me | null) => void;
  setHydrated: () => void;
};

/**
 * Tokens live in SecureStore (lib/api.ts); `me` persists to MMKV so a cold
 * start (even offline) renders the signed-in posture on first frame, and the
 * shell SessionHydrator reconciles it against `/me` at boot. `hydrated` is
 * deliberately NOT persisted — it means "this launch's reconciliation ran".
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      me: null,
      hydrated: false,
      setMe: (me) => set({ me }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "terminal.session",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (s) => ({ me: s.me }),
    },
  ),
);
