"use client";

// P10 · Storefront: live preview-as-hirer + edit drawer (cover/logo, about,
// name) + share (copies the public /s/{id} URL) + badge state w/ CAC CTA.
import { Link2, Pencil } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { VerificationDialog } from "@/components/assets/verification-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { StorefrontView, type StorefrontData } from "@/components/storefront/storefront-view";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, bff } from "@/lib/api";
import { keys, useInvalidate, useMe, useSupplierProfile } from "@/lib/queries";
import type { PresignResult } from "@/lib/types";

export default function StorefrontPage() {
  const me = useMe();
  const profile = useSupplierProfile(Boolean(me.data?.is_supplier));
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [about, setAbout] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const storefront = useQuery({
    queryKey: ["storefront", me.data?.id],
    queryFn: () => bff<StorefrontData>(`/storefronts/${me.data!.id}`),
    enabled: Boolean(me.data?.id && me.data?.is_supplier),
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await bff("/suppliers/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...(name !== null ? { business_name: name } : {}),
          ...(about !== null ? { description: about } : {}),
        }),
      });
      await invalidate(keys.profile, ["storefront"]);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setError(null);
    try {
      const presign = await bff<PresignResult>("/media/presign", {
        method: "POST",
        body: JSON.stringify({ kind: "logo", content_type: file.type || "image/jpeg", file_size: file.size }),
      });
      const put = await fetch(presign.presigned_put_url, {
        method: "PUT",
        headers: { "content-type": file.type || "image/jpeg" },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      await bff("/suppliers/me/profile", { method: "PATCH", body: JSON.stringify({ logo_key: presign.key }) });
      await invalidate(keys.profile, ["storefront"]);
    } catch {
      setError("Logo upload failed. Try a smaller image.");
    }
  }

  function share() {
    const url = `${window.location.origin}/s/${me.data?.id}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    });
  }

  const badge = storefront.data?.verification_badge;

  return (
    <>
      <PageHeader
        title="Storefront"
        action={
          <div className="flex gap-s2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} aria-hidden /> Edit
            </Button>
            <Button onClick={share}>
              <Link2 size={15} aria-hidden /> {copied ? "Copied" : "Share storefront"}
            </Button>
          </div>
        }
      />

      {badge !== "business_verified" ? (
        <Banner
          tone="info"
          className="mb-s4"
          action={
            <Button size="sm" variant="secondary" onClick={() => setVerifyOpen(true)}>
              Upgrade with CAC
            </Button>
          }
        >
          {badge === "verified"
            ? "You're identity-verified. Add your CAC registration for the Business Verified shield — it wins bigger hirers."
            : "Verify your identity to publish, then add CAC for the Business Verified shield."}
        </Banner>
      ) : null}

      {error ? <Banner tone="danger" className="mb-s4">{error}</Banner> : null}

      <p className="mb-s3 text-caption text-ink-500">Previewing as a hirer sees it — the public page carries no edit controls.</p>

      <Card className="p-s6">
        {storefront.isPending || !me.data ? (
          <div className="flex flex-col gap-s4">
            <Skeleton className="h-s8 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : storefront.isError ? (
          <Banner tone="danger">Couldn&apos;t load your storefront preview.</Banner>
        ) : (
          <StorefrontView data={storefront.data} />
        )}
      </Card>

      {/* edit drawer (right, per 08 choreography: enters from the cause) */}
      {editing ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40" role="dialog" aria-modal="true" aria-label="Edit storefront">
          <div className="flex h-full w-[min(26rem,100vw)] flex-col gap-s4 overflow-y-auto bg-surface-card p-s5 shadow-e2">
            <h2 className="font-display text-h3 text-text-primary">Edit storefront</h2>
            <TextField
              label="Business name"
              value={name ?? profile.data?.business_name ?? ""}
              onChange={(e) => setName(e.target.value)}
              placeholder="Okafor Plant Hire Ltd"
            />
            <div className="flex flex-col gap-s1">
              <label htmlFor="store-about" className="text-caption font-medium text-text-secondary">About</label>
              <textarea
                id="store-about"
                rows={5}
                value={about ?? profile.data?.description ?? ""}
                onChange={(e) => setAbout(e.target.value)}
                className="rounded-sm border border-border-default p-s3 text-body-sm outline-none"
                placeholder="What you run, where you work, since when."
              />
            </div>
            <div className="flex flex-col gap-s1">
              <label htmlFor="store-logo" className="text-caption font-medium text-text-secondary">Logo</label>
              <input
                id="store-logo"
                type="file"
                accept="image/*"
                className="text-body-sm"
                onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])}
              />
            </div>
            <div className="mt-auto flex justify-end gap-s2">
              <Button variant="secondary" onClick={() => setEditing(false)}>Close</Button>
              <Button onClick={save} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      <VerificationDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </>
  );
}
