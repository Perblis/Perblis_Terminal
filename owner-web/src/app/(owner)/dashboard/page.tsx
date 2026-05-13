"use client";

import { Button } from "@/components/ui/Button";
import { useLogout, useMe } from "@/hooks/useAuth";

export default function DashboardPage() {
  const me = useMe();
  const logout = useLogout();

  return (
    <main className="min-h-screen space-y-6 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-[36px] leading-none tracking-tight uppercase">
            Welcome
          </div>
          <p className="text-text-secondary mt-2 text-[14px]">
            Dashboard arrives in Wave 02. This page proves the auth round-trip.
          </p>
        </div>
        <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      {me.isLoading ? (
        <p className="text-text-secondary text-[13px]">Loading account…</p>
      ) : me.isError ? (
        <p className="text-alert-soft text-[13px]">Could not load your account.</p>
      ) : (
        <pre className="bg-surface border-border rounded-card text-text-primary overflow-auto border p-4 font-mono text-[13px]">
          {JSON.stringify(me.data, null, 2)}
        </pre>
      )}
    </main>
  );
}
