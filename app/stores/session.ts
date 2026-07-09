import { create } from "zustand";

import type { Me } from "../lib/types";

type SessionState = {
  /** null = guest (FSD §6 guest posture). Populated after login/refresh. */
  me: Me | null;
  /** True once the stored refresh token has been checked on cold start. */
  hydrated: boolean;
  setMe: (me: Me | null) => void;
  setHydrated: () => void;
};

/**
 * In-memory only — tokens live in SecureStore (lib/api.ts), `me` is
 * re-fetched via TanStack Query; this store just gates navigation
 * (guest vs signed-in) without a query waterfall.
 */
export const useSession = create<SessionState>()((set) => ({
  me: null,
  hydrated: false,
  setMe: (me) => set({ me }),
  setHydrated: () => set({ hydrated: true }),
}));
