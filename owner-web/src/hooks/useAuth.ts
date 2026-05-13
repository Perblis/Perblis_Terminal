"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { UserMe } from "@/lib/api/auth";
import { loadTokensFromStorage, setTokens } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { QUERY_KEYS } from "@/lib/constants";

export function useMe() {
  // Hydrate the in-memory token cache from localStorage on first client mount
  // so the very first /users/me request carries the Authorization header.
  useEffect(() => {
    loadTokensFromStorage();
  }, []);

  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: async () => {
      const res = await usersApi.me();
      return res.data;
    },
    staleTime: 60_000,
    retry: false,
  });
}

type LoginInput = { email: string; password: string; next?: string };

type LoginRouteResponse = {
  ok: true;
  access: string;
  refresh: string;
  user: UserMe;
};

export function useLogin() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.email, password: input.password }),
      });
      const data: LoginRouteResponse | { error?: { detail?: string } } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        const errBody = data as { error?: { detail?: string } };
        throw new Error(errBody.error?.detail ?? "Sign-in failed. Check your credentials.");
      }

      const ok = data as LoginRouteResponse;
      setTokens(ok.access, ok.refresh);
      return { next: input.next ?? "/dashboard", user: ok.user };
    },
    onSuccess: ({ next }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
      router.replace(next);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      setTokens(null, null);
    },
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
  });
}

/**
 * Convenience: combined `{ user, isLoading, signOut }` shape for callers
 * that don't want to pull `useMe` + `useLogout` separately.
 */
export function useAuth() {
  const me = useMe();
  const logout = useLogout();
  return {
    user: me.data,
    isLoading: me.isLoading,
    isError: me.isError,
    signOut: logout.mutate,
    isSigningOut: logout.isPending,
  };
}
