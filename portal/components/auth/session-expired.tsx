"use client";

// F12: refresh expired → re-auth modal preserving the route. The BFF signals
// via the session-expired window event (lib/api.ts); signing in here never
// navigates, so screen intent survives. Radix Dialog per D-020 (focus trap +
// scroll lock + aria); all styling is bespoke tokens.

import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { WordmarkInline } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { ApiError, auth, SESSION_EXPIRED_EVENT } from "@/lib/api";

export function SessionExpiredProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, show);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, show);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await auth("/login", { email, password });
      setOpen(false);
      setPassword("");
      // Every query re-fetches under the fresh session; the route never moved.
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign-in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-card p-s5 shadow-e2"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <WordmarkInline className="mb-s4" />
            <Dialog.Title className="font-display text-h3 text-text-primary">
              Your session has expired
            </Dialog.Title>
            <Dialog.Description className="mt-s1 text-body-sm text-text-secondary">
              Sign in again to pick up where you left off — this page stays put.
            </Dialog.Description>
            <form onSubmit={submit} className="mt-s4 flex flex-col gap-s3">
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordField
                label="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error ?? undefined}
              />
              <Button type="submit" size="lg" loading={submitting} className="mt-s2 w-full">
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/login")}
                className="w-full"
              >
                Go to sign-in page
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
