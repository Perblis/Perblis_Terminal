"use client";

import { useCallback, useEffect, useState } from "react";

import { getAccessToken, loadTokensFromStorage, setTokens } from "@/lib/api/client";

/**
 * Minimal client-side auth hook. Wave 01 expands this with /users/me
 * fetching via React Query and exposes the full user object.
 */
export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadTokensFromStorage();
    setToken(getAccessToken());
    setHydrated(true);
  }, []);

  const signOut = useCallback(() => {
    setTokens(null, null);
    setToken(null);
  }, []);

  return {
    isAuthenticated: Boolean(token),
    isHydrated,
    accessToken: token,
    signOut,
  };
}
