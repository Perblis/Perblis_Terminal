"use client";

// F2 identity verification, reachable contextually from the publish block —
// never a dead-end (07 §7). Multipart to /bff/me/verification.
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiError, bff } from "@/lib/api";
import { keys, useInvalidate } from "@/lib/queries";

export function VerificationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<"identity" | "business">("identity");
  const [rcNumber, setRcNumber] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate();

  async function submit() {
    if (files.length === 0) {
      setError("Attach at least one document photo or scan.");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("kind", kind);
    if (kind === "business") form.set("rc_number", rcNumber);
    for (const file of files) form.append("documents", file);
    try {
      await bff("/me/verification", { method: "POST", body: form });
      setDone(true);
      await invalidate(keys.me);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-card p-s5 shadow-e2">
          <div className="flex items-start justify-between">
            <Dialog.Title className="font-display text-h3 text-text-primary">
              Verify your identity
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded-sm p-s1 text-ink-500 hover:bg-ink-100">
              <X size={18} />
            </Dialog.Close>
          </div>

          {done ? (
            <div className="mt-s4 flex flex-col gap-s4">
              <Banner tone="info">
                Documents received. We review within 12 hours — you can keep building your listing
                meanwhile; publishing unlocks the moment you&apos;re verified.
              </Banner>
              <Button onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="mt-s4 flex flex-col gap-s4">
              <div className="flex gap-s2" role="radiogroup" aria-label="Verification type">
                {(["identity", "business"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={
                      kind === k
                        ? "rounded-sm border border-border-structural bg-ink-900 px-s3 py-s2 text-body-sm text-text-inverse"
                        : "rounded-sm border border-border-default px-s3 py-s2 text-body-sm text-text-secondary hover:bg-ink-50"
                    }
                  >
                    {k === "identity" ? "Identity (NIN / licence)" : "Business (CAC)"}
                  </button>
                ))}
              </div>
              {kind === "business" ? (
                <TextField
                  label="RC number"
                  value={rcNumber}
                  onChange={(e) => setRcNumber(e.target.value)}
                  placeholder="RC1234567"
                />
              ) : null}
              <div className="flex flex-col gap-s1">
                <label className="text-caption font-medium text-text-secondary" htmlFor="verif-docs">
                  Documents (up to 5)
                </label>
                <input
                  id="verif-docs"
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="text-body-sm"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
                />
                <p className="text-caption text-ink-500">
                  Clear photos or scans. Reviewed by a person — 12h turnaround.
                </p>
              </div>
              {error ? (
                <p className="text-body-sm text-text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button onClick={submit} loading={busy}>
                Submit for review
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
