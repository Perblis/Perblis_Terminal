"use client";

// P11 · Settings. Personal · business · BANK VAULT (D-021 ink panel, masked
// mono, password re-auth ceremony, encryption note) · notification toggles ·
// verification status/resubmit · account (password reset email; delete with
// 30-day copy — the API enforces the active-hire guard) · legal.
import { Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { VerificationDialog } from "@/components/assets/verification-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CornerBracketPanel } from "@/components/ui/corner-brackets";
import { PasswordField, TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, auth, bff } from "@/lib/api";
import { keys, useInvalidate, useMe, useSupplierProfile } from "@/lib/queries";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-s3">
      <h2 className="font-display text-h3 text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

const NOTIF_LABELS: Record<string, string> = {
  notif_hire_requests: "Hire requests and status changes",
  notif_messages: "New messages",
  notif_payouts: "Payouts",
  notif_marketing: "Product news from Terminal",
};

export default function SettingsPage() {
  const me = useMe();
  const profile = useSupplierProfile(Boolean(me.data?.is_supplier));
  const invalidate = useInvalidate();

  const [fullName, setFullName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vault, setVault] = useState({ password: "", bank_name: "", bank_account_number: "", bank_account_name: "" });
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const verification = useQuery({
    queryKey: ["verification-status"],
    queryFn: () =>
      bff<{ account_level: string; requests: { id: string; kind: string; state: string; created_at: string; reason?: string }[] }>(
        "/me/verification",
      ),
  });

  async function saveName() {
    if (fullName === null) return;
    setSavingName(true);
    try {
      await bff("/me", { method: "PATCH", body: JSON.stringify({ full_name: fullName }) });
      await invalidate(keys.me);
      setNotice("Name updated.");
    } catch {
      setNotice(null);
    } finally {
      setSavingName(false);
    }
  }

  async function saveVault() {
    setVaultBusy(true);
    setVaultError(null);
    try {
      // Re-auth ceremony: prove the password before the vault opens for writes.
      await auth("/login", { email: me.data?.email, password: vault.password });
      await bff("/suppliers/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bank_name: vault.bank_name,
          bank_account_number: vault.bank_account_number,
          bank_account_name: vault.bank_account_name,
        }),
      });
      await invalidate(keys.profile);
      setVaultOpen(false);
      setVault({ password: "", bank_name: "", bank_account_number: "", bank_account_name: "" });
      setNotice("Bank details updated.");
    } catch (e) {
      setVaultError(e instanceof ApiError ? e.message : "Couldn't update bank details.");
    } finally {
      setVaultBusy(false);
    }
  }

  async function toggleNotif(key: string, value: boolean) {
    await bff("/suppliers/me/profile", { method: "PATCH", body: JSON.stringify({ [key]: value }) });
    await invalidate(keys.profile);
  }

  async function requestPasswordReset() {
    await auth("/password-reset", { email: me.data?.email });
    setNotice(`Password reset link sent to ${me.data?.email}.`);
  }

  async function deleteAccount() {
    setDeleteError(null);
    try {
      await bff("/me", { method: "DELETE" });
      window.location.href = "/login";
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Deletion is blocked right now.");
    }
  }

  if (me.isPending) {
    return (
      <div className="flex flex-col gap-s4">
        <Skeleton className="h-s6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const latestRequest = verification.data?.requests?.[0];

  return (
    <>
      <PageHeader title="Settings" />
      {notice ? <Banner tone="info" className="mb-s4">{notice}</Banner> : null}

      <div className="flex max-w-2xl flex-col gap-s7 pb-s8">
        <Section title="Personal">
          <Card className="flex flex-col gap-s3">
            <TextField
              label="Full name"
              value={fullName ?? me.data?.full_name ?? ""}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-s3">
              <TextField label="Email" value={me.data?.email ?? ""} disabled readOnly helper="Contact support to change." />
              <TextField label="Phone" value={me.data?.phone ?? ""} disabled readOnly helper="Contact support to change." />
            </div>
            <Button className="self-end" onClick={saveName} loading={savingName} disabled={fullName === null}>
              Save
            </Button>
          </Card>
        </Section>

        {me.data?.is_supplier ? (
          <>
            <Section title="Business profile">
              <Card className="flex items-center justify-between gap-s3">
                <div>
                  <p className="text-body font-medium text-text-primary">{profile.data?.business_name || "No business name yet"}</p>
                  <p className="text-caption text-ink-500">Name, about, and logo are edited on the Storefront page — what hirers see is what you edit.</p>
                </div>
                <Button variant="secondary" onClick={() => (window.location.href = "/storefront")}>Edit storefront</Button>
              </Card>
            </Section>

            <Section title="Bank details">
              <CornerBracketPanel inverse className="bg-surface-inverse p-s5 text-text-inverse">
                <p className="flex items-center gap-s2 font-display text-overline uppercase tracking-[0.1em] text-ink-300">
                  <Lock size={12} aria-hidden /> Payout account
                </p>
                <p className="mt-s2 font-mono text-mono-lg">
                  {profile.data?.bank_account_number_masked || "•••• not set"}
                </p>
                <p className="text-body-sm text-ink-300">
                  {profile.data?.bank_name || "—"}
                  {profile.data && "bank_account_name" in profile.data
                    ? ` · ${(profile.data as { bank_account_name?: string }).bank_account_name ?? ""}`
                    : ""}
                </p>
                <div className="mt-s4 flex items-center justify-between gap-s3">
                  <p className="text-caption text-ink-400">Encrypted at rest — only the payout desk ever sees the full number.</p>
                  <Button variant="secondary" className="border-ink-600 text-text-inverse hover:bg-ink-800" onClick={() => setVaultOpen(true)}>
                    {profile.data?.bank_account_number_masked ? "Change" : "Add details"}
                  </Button>
                </div>
              </CornerBracketPanel>
              {vaultOpen ? (
                <Card className="flex flex-col gap-s3">
                  <p className="text-body-sm text-text-secondary">Confirm your password to change where money lands.</p>
                  <PasswordField
                    label="Password"
                    autoComplete="current-password"
                    value={vault.password}
                    onChange={(e) => setVault({ ...vault, password: e.target.value })}
                  />
                  <TextField label="Bank" value={vault.bank_name} onChange={(e) => setVault({ ...vault, bank_name: e.target.value })} placeholder="GTBank" />
                  <TextField
                    label="Account number"
                    inputMode="numeric"
                    className="font-mono"
                    value={vault.bank_account_number}
                    onChange={(e) => setVault({ ...vault, bank_account_number: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                    helper="10 digits (NUBAN)."
                  />
                  <TextField label="Account name" value={vault.bank_account_name} onChange={(e) => setVault({ ...vault, bank_account_name: e.target.value })} />
                  {vaultError ? <p className="text-body-sm text-text-danger" role="alert">{vaultError}</p> : null}
                  <div className="flex justify-end gap-s2">
                    <Button variant="secondary" onClick={() => setVaultOpen(false)}>Cancel</Button>
                    <Button onClick={saveVault} loading={vaultBusy} disabled={!vault.password || vault.bank_account_number.length !== 10}>
                      Save bank details
                    </Button>
                  </div>
                </Card>
              ) : null}
            </Section>

            <Section title="Email notifications">
              <Card className="flex flex-col gap-s2">
                {Object.entries(NOTIF_LABELS).map(([key, label]) => {
                  const checked = Boolean((profile.data as unknown as Record<string, boolean> | undefined)?.[key]);
                  return (
                    <label key={key} className="flex items-center justify-between gap-s3 py-s1 text-body-sm text-text-primary">
                      {label}
                      <input
                        type="checkbox"
                        className="size-s4 accent-amber-500"
                        checked={checked}
                        onChange={(e) => void toggleNotif(key, e.target.checked)}
                      />
                    </label>
                  );
                })}
              </Card>
            </Section>
          </>
        ) : null}

        <Section title="Verification">
          <Card className="flex items-center justify-between gap-s3">
            <div>
              <p className="flex items-center gap-s2 text-body font-medium text-text-primary">
                {me.data?.is_verified ? <ShieldCheck size={18} className="text-blue-600" aria-hidden /> : null}
                {me.data?.account_level === "business_verified"
                  ? "Business verified"
                  : me.data?.account_level === "verified"
                    ? "Verified"
                    : latestRequest?.state === "pending"
                      ? "Documents under review"
                      : "Not verified"}
              </p>
              <p className="text-caption text-ink-500">
                {latestRequest?.state === "pending"
                  ? "We review within 12 hours — you can keep working meanwhile."
                  : latestRequest?.state === "rejected"
                    ? `We couldn't verify: ${latestRequest.reason ?? "see email"}. Fix and resubmit.`
                    : "Verification unlocks publishing and higher-value hires."}
              </p>
            </div>
            {me.data?.account_level !== "business_verified" ? (
              <Button variant="secondary" onClick={() => setVerifyOpen(true)}>
                {latestRequest?.state === "rejected" ? "Resubmit" : "Verify"}
              </Button>
            ) : null}
          </Card>
        </Section>

        <Section title="Account">
          <Card className="flex flex-col gap-s3">
            <div className="flex items-center justify-between gap-s3">
              <p className="text-body-sm text-text-secondary">Password — we email you a reset link.</p>
              <Button variant="secondary" onClick={() => void requestPasswordReset()}>Send reset link</Button>
            </div>
            <div className="flex items-center justify-between gap-s3 border-t border-border-default pt-s3">
              <p className="text-body-sm text-text-secondary">
                Delete account — 30-day grace, blocked while hires are active. Financial records are
                retained as the law requires.
              </p>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete account</Button>
            </div>
            {deleteError ? <Banner tone="warning">{deleteError}</Banner> : null}
          </Card>
        </Section>

        <Section title="Legal">
          <Card className="flex gap-s4 text-body-sm">
            <a className="text-text-link underline" href="https://terminal.africa/terms" target="_blank" rel="noreferrer">Terms of Service</a>
            <a className="text-text-link underline" href="https://terminal.africa/privacy" target="_blank" rel="noreferrer">Privacy (NDPR)</a>
            <a className="text-text-link underline" href="mailto:support@terminal.africa">support@terminal.africa</a>
          </Card>
        </Section>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-s4" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <Card className="w-full max-w-md p-s5">
            <h2 className="font-display text-h3 text-text-primary">Delete your account?</h2>
            <p className="mt-s2 text-body-sm text-text-secondary">
              Your data is removed after a 30-day grace period. Active or unsettled hires block
              deletion. This signs you out immediately.
            </p>
            <div className="mt-s4 flex justify-end gap-s2">
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Keep account</Button>
              <Button variant="destructive" onClick={() => void deleteAccount()}>Delete account</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <VerificationDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </>
  );
}
