"use client";

// P4 · Asset Form — six-step Stepper with per-step save (F9). Steps 1–2 live
// locally (the API's draft floor is class+type+title+description+daily price);
// completing Pricing creates the server draft, and every later Next PATCHes.
// A refresh mid-form resumes from localStorage (new) or the server (edit).
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ApiError, bff } from "@/lib/api";
import { keys, useInvalidate } from "@/lib/queries";
import type { GeoPoint, Listing } from "@/lib/types";

import { ClassStep, PricingStep, SpecsStep } from "./form-steps";
import { LocationStep, PhotosStep, ReviewStep } from "./form-steps-media";

export type AssetDraft = {
  asset_class: string;
  asset_type: string;
  title: string;
  description: string;
  specs: Record<string, unknown>;
  daily_price: number | null; // kobo
  weekly_price: number | null;
  monthly_price: number | null;
  unit_count: number;
  unit_labels: string[];
  yard_id: string | null;
  point: GeoPoint | null;
  address_text: string;
  city: string;
};

const EMPTY: AssetDraft = {
  asset_class: "",
  asset_type: "",
  title: "",
  description: "",
  specs: {},
  daily_price: null,
  weekly_price: null,
  monthly_price: null,
  unit_count: 1,
  unit_labels: [],
  yard_id: null,
  point: null,
  address_text: "",
  city: "",
};

const LOCAL_KEY = "terminal:asset-draft";
const STEPS = ["Class & type", "Details & specs", "Pricing & units", "Photos", "Location", "Review"];

export function AssetForm({ initial }: { initial?: Listing }) {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [listing, setListing] = useState<Listing | null>(initial ?? null);
  const [draft, setDraft] = useState<AssetDraft>(() =>
    initial
      ? {
          asset_class: initial.asset_class,
          asset_type: initial.asset_type,
          title: initial.title,
          description: initial.description,
          specs: initial.specs,
          daily_price: initial.daily_price,
          weekly_price: initial.weekly_price,
          monthly_price: initial.monthly_price,
          unit_count: initial.unit_count,
          unit_labels: initial.units.map((u) => u.label),
          yard_id: initial.yard_id,
          point: initial.point,
          address_text: initial.address_text,
          city: initial.city,
        }
      : EMPTY,
  );
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume a locally-parked draft (new-listing flow only).
  useEffect(() => {
    if (initial) return;
    try {
      const parked = window.localStorage.getItem(LOCAL_KEY);
      if (parked) {
        const data = JSON.parse(parked) as { draft: AssetDraft; step: number; listingId?: string };
        setDraft({ ...EMPTY, ...data.draft });
        setStep(Math.min(data.step, STEPS.length - 1));
        if (data.listingId) {
          bff<Listing>(`/listings/${data.listingId}`).then(setListing).catch(() => undefined);
        }
      }
    } catch {
      // corrupt parked draft — start clean
    }
  }, [initial]);

  const persistLocal = useCallback(
    (next: AssetDraft, nextStep: number, listingId?: string) => {
      if (initial) return;
      window.localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({ draft: next, step: nextStep, listingId: listingId ?? listing?.id }),
      );
    },
    [initial, listing?.id],
  );

  const set = useCallback(<K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const serverPayload = useMemo(
    () => ({
      title: draft.title,
      description: draft.description,
      specs: draft.specs,
      daily_price: draft.daily_price ?? undefined,
      weekly_price: draft.weekly_price,
      monthly_price: draft.monthly_price,
      unit_count: draft.unit_count,
      yard_id: draft.yard_id,
      point: draft.point,
      address_text: draft.address_text,
      city: draft.city,
    }),
    [draft],
  );

  /** Create the server draft (first time past Pricing) or sync it. */
  async function syncServer(): Promise<Listing | null> {
    if (!draft.daily_price) return listing;
    if (!listing) {
      const created = await bff<Listing>("/listings", {
        method: "POST",
        body: JSON.stringify({
          asset_class: draft.asset_class,
          asset_type: draft.asset_type,
          unit_labels: draft.unit_labels.filter(Boolean),
          ...serverPayload,
        }),
      });
      setListing(created);
      await invalidate(keys.listings);
      return created;
    }
    const updated = await bff<Listing>(`/listings/${listing.id}`, {
      method: "PATCH",
      body: JSON.stringify(serverPayload),
    });
    setListing(updated);
    await invalidate(keys.listings);
    return updated;
  }

  async function next() {
    setError(null);
    setSaving(true);
    try {
      const synced = step >= 2 ? await syncServer() : listing;
      const target = Math.min(step + 1, STEPS.length - 1);
      setStep(target);
      persistLocal(draft, target, synced?.id);
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 1200);
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        setError(Object.values(e.fields).flat().join(" "));
      } else {
        setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function back() {
    const target = Math.max(step - 1, 0);
    setStep(target);
    persistLocal(draft, target);
  }

  function finish() {
    window.localStorage.removeItem(LOCAL_KEY);
    router.push("/assets");
  }

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(draft.asset_class && draft.asset_type);
      case 1:
        return draft.title.trim().length > 0 && draft.description.trim().length >= 50;
      case 2:
        return Boolean(draft.daily_price) && draft.unit_count >= 1;
      case 4:
        return Boolean(draft.yard_id || draft.point);
      default:
        return true;
    }
  }, [step, draft]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* progress rail */}
      <ol className="mb-s6 flex items-center gap-s2" aria-label="Form steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-s1">
            <span
              className={
                i < step
                  ? "h-s1 rounded-pill bg-amber-500"
                  : i === step
                    ? "h-s1 rounded-pill bg-amber-500/60"
                    : "h-s1 rounded-pill bg-ink-200"
              }
              aria-hidden
            />
            <span
              className={
                i === step ? "text-caption font-medium text-text-primary" : "hidden text-caption text-ink-500 lg:block"
              }
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {initial && initial.status !== "draft" ? (
        <Banner tone="info" className="mb-s4">
          Edits go live immediately but never touch locked terms — hires already agreed keep the
          price and specs they were accepted with.
        </Banner>
      ) : null}

      {error ? (
        <Banner tone="danger" className="mb-s4">
          {error}
        </Banner>
      ) : null}

      <div className="rounded-md border border-border-default bg-surface-card p-s5">
        {step === 0 ? <ClassStep draft={draft} set={set} locked={Boolean(listing)} /> : null}
        {step === 1 ? <SpecsStep draft={draft} set={set} /> : null}
        {step === 2 ? <PricingStep draft={draft} set={set} /> : null}
        {step === 3 ? <PhotosStep listing={listing} onChanged={setListing} /> : null}
        {step === 4 ? <LocationStep draft={draft} set={set} /> : null}
        {step === 5 ? (
          <ReviewStep draft={draft} listing={listing} onPublished={finish} onSynced={setListing} />
        ) : null}
      </div>

      <div className="mt-s4 flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0 || saving}>
          Back
        </Button>
        <div className="flex items-center gap-s3">
          {savedPulse ? (
            <span className="flex items-center gap-s1 text-caption text-green-700">
              <Check size={14} aria-hidden /> Draft saved
            </span>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={!stepValid} loading={saving}>
              {step === 2 && !listing ? "Save draft & continue" : "Next"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
