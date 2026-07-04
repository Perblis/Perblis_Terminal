"use client";

// P4 steps ①–③: class & type, template-driven specs, pricing & units.
import { useMemo } from "react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { TextField } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { ASSET_CLASSES, CLASS_BY_VALUE } from "@/lib/asset-classes";
import { formatNairaInput, parseNairaInput } from "@/lib/naira";
import { useSpecTemplate } from "@/lib/queries";
import type { AssetClass, SpecField } from "@/lib/types";

import type { AssetDraft } from "./asset-form";

type StepProps = {
  draft: AssetDraft;
  set: <K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => void;
};

// ① Class cards with glyphs → type select. Class/type lock once the server
// draft exists (spec templates key on them; change = start a new listing).
export function ClassStep({ draft, set, locked }: StepProps & { locked: boolean }) {
  const meta = draft.asset_class ? CLASS_BY_VALUE[draft.asset_class as AssetClass] : null;
  return (
    <div className="flex flex-col gap-s5">
      <div>
        <h2 className="font-display text-h3 text-text-primary">What are you listing?</h2>
        {locked ? (
          <p className="mt-s1 text-caption text-ink-500">
            Class and type are fixed for an existing listing — duplicate it to change them.
          </p>
        ) : null}
      </div>
      <div className="grid gap-s3 sm:grid-cols-2">
        {ASSET_CLASSES.map((cls) => {
          const Glyph = CLASS_GLYPHS[cls.value];
          const active = draft.asset_class === cls.value;
          return (
            <button
              key={cls.value}
              type="button"
              disabled={locked}
              onClick={() => {
                set("asset_class", cls.value);
                set("asset_type", "");
                set("specs", {});
              }}
              aria-pressed={active}
              className={`flex items-center gap-s3 rounded-md border p-s4 text-left transition-colors duration-quick disabled:opacity-60 ${
                active
                  ? "border-border-structural bg-surface-sunken"
                  : "border-border-default hover:border-border-strong"
              }`}
            >
              <span className={`grid size-s7 shrink-0 place-items-center rounded-sm ${cls.bg} ${cls.text}`}>
                <Glyph size={22} />
              </span>
              <span>
                <span className="block text-body font-medium text-text-primary">{cls.label}</span>
                <span className="block text-caption text-ink-500">
                  {cls.types.length} asset types
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {meta ? (
        <div className="flex flex-col gap-s1">
          <label htmlFor="asset-type" className="text-caption font-medium text-text-secondary">
            Asset type
          </label>
          <select
            id="asset-type"
            disabled={locked}
            value={draft.asset_type}
            onChange={(e) => {
              set("asset_type", e.target.value);
              set("specs", {});
            }}
            className="h-10 rounded-sm border border-border-default bg-surface-card px-s3 text-body-sm outline-none"
          >
            <option value="">Choose a type…</option>
            {meta.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function SpecInput({
  specKey,
  field,
  value,
  onChange,
}: {
  specKey: string;
  field: SpecField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = field.unit ? `${field.display_name} (${field.unit})` : field.display_name;
  if (field.kind === "select" || field.kind === "multi") {
    return (
      <div className="flex flex-col gap-s1">
        <label htmlFor={`spec-${specKey}`} className="text-caption font-medium text-text-secondary">
          {label}
          {field.required ? " *" : ""}
        </label>
        <select
          id={`spec-${specKey}`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="h-10 rounded-sm border border-border-default bg-surface-card px-s3 text-body-sm outline-none"
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-s2 pt-s5 text-body-sm text-text-secondary">
        <input
          type="checkbox"
          className="size-s4 accent-amber-500"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  }
  return (
    <TextField
      label={`${label}${field.required ? " *" : ""}`}
      inputMode={field.kind === "number" ? "decimal" : undefined}
      className={field.kind === "number" ? "font-mono" : undefined}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (field.kind === "number") {
          const n = raw === "" ? undefined : Number(raw);
          onChange(n === undefined || Number.isNaN(n) ? undefined : n);
        } else {
          onChange(raw || undefined);
        }
      }}
    />
  );
}

// ② Title/description + template-driven specs with the completeness meter.
export function SpecsStep({ draft, set }: StepProps) {
  const template = useSpecTemplate(draft.asset_class, draft.asset_type);
  const fields = useMemo(() => Object.entries(template.data?.fields ?? {}), [template.data]);

  const filled = fields.filter(([key]) => {
    const v = draft.specs[key];
    return v !== undefined && v !== null && v !== "";
  }).length;
  const requiredMissing = fields.filter(
    ([key, f]) => f.required && (draft.specs[key] === undefined || draft.specs[key] === ""),
  ).length;
  const ratio = fields.length ? filled / fields.length : 0;
  const tier = ratio >= 0.85 ? "Standout listing" : ratio >= 0.5 ? "Strong listing" : "Basic listing";
  const nextUnlock =
    ratio >= 0.85 ? null : ratio >= 0.5 ? "fill 85% for a Standout listing" : "fill half the specs for a Strong listing";

  return (
    <div className="flex flex-col gap-s5">
      <h2 className="font-display text-h3 text-text-primary">Details & specs</h2>
      <TextField
        label="Title"
        placeholder="CAT 320D excavator with operator"
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
        helper="What hirers see first — make, model, the essentials."
      />
      <div className="flex flex-col gap-s1">
        <label htmlFor="asset-desc" className="text-caption font-medium text-text-secondary">
          Description
        </label>
        <textarea
          id="asset-desc"
          rows={4}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          className="rounded-sm border border-border-default bg-surface-card p-s3 text-body-sm outline-none placeholder:text-ink-400"
          placeholder="Condition, what's included, site requirements, anything a hirer should know before requesting."
        />
        <p className={`text-caption ${draft.description.trim().length >= 50 ? "text-ink-500" : "text-amber-900"}`}>
          {draft.description.trim().length}/50 characters minimum
        </p>
      </div>

      {template.isPending && draft.asset_type ? (
        <p className="text-body-sm text-text-secondary">Loading the {draft.asset_type} spec sheet…</p>
      ) : fields.length > 0 ? (
        <>
          <div className="flex items-center justify-between rounded-sm bg-surface-sunken px-s3 py-s2">
            <span className="text-caption font-medium text-text-primary">{tier}</span>
            <span className="text-caption text-ink-500">
              {filled}/{fields.length} specs{nextUnlock ? ` — ${nextUnlock}` : " — complete"}
            </span>
          </div>
          <div className="grid gap-s4 sm:grid-cols-2">
            {fields.map(([key, field]) => (
              <SpecInput
                key={key}
                specKey={key}
                field={field}
                value={draft.specs[key]}
                onChange={(v) => {
                  const specs = { ...draft.specs };
                  if (v === undefined) delete specs[key];
                  else specs[key] = v;
                  set("specs", specs);
                }}
              />
            ))}
          </div>
          {requiredMissing > 0 ? (
            <p className="text-caption text-amber-900">
              {requiredMissing} required spec{requiredMissing > 1 ? "s" : ""} still empty — needed
              before this can go live.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
  helper,
  required,
}: {
  label: string;
  value: number | null;
  onChange: (kobo: number | null) => void;
  helper?: string;
  required?: boolean;
}) {
  return (
    <TextField
      label={`${label}${required ? " *" : ""}`}
      prefix="₦"
      inputMode="numeric"
      className="font-mono"
      value={formatNairaInput(value)}
      onChange={(e) => onChange(parseNairaInput(e.target.value))}
      helper={helper}
      placeholder="250,000"
    />
  );
}

/** D-008 best-price preview over the supplier's own draft rates — a sample,
 * never transactional money (LockedTerms remains the only money truth). */
function samplePrice(draft: AssetDraft, days: number): { total: number; scheme: string } | null {
  if (!draft.daily_price) return null;
  const options: [number, string][] = [[draft.daily_price * days, `${days} × daily`]];
  if (draft.weekly_price) {
    options.push([draft.weekly_price * Math.ceil(days / 7), `${Math.ceil(days / 7)} × weekly`]);
  }
  if (draft.monthly_price) {
    options.push([draft.monthly_price * Math.ceil(days / 30), `${Math.ceil(days / 30)} × monthly`]);
  }
  const [total, scheme] = options.reduce((a, b) => (b[0] < a[0] ? b : a));
  return { total, scheme };
}

// ③ Pricing & units.
export function PricingStep({ draft, set }: StepProps) {
  const preview = samplePrice(draft, 14);
  const naiveDaily = draft.daily_price ? draft.daily_price * 14 : null;
  return (
    <div className="flex flex-col gap-s5">
      <h2 className="font-display text-h3 text-text-primary">Pricing & units</h2>
      <div className="grid gap-s4 sm:grid-cols-3">
        <PriceField
          label="Daily rate"
          required
          value={draft.daily_price}
          onChange={(v) => set("daily_price", v)}
        />
        <PriceField
          label="Weekly rate"
          value={draft.weekly_price}
          onChange={(v) => set("weekly_price", v)}
        />
        <PriceField
          label="Monthly rate"
          value={draft.monthly_price}
          onChange={(v) => set("monthly_price", v)}
        />
      </div>
      {!draft.weekly_price && !draft.monthly_price ? (
        <p className="text-caption text-ink-500">
          Set weekly and monthly rates to win longer hires — Terminal always charges the hirer the
          cheapest applicable scheme.
        </p>
      ) : null}
      {preview ? (
        <div className="rounded-sm border border-border-default bg-surface-sunken p-s3 text-body-sm">
          <span className="text-text-secondary">A 14-day hire would price at </span>
          <Money kobo={preview.total} />
          <span className="text-text-secondary"> ({preview.scheme}</span>
          {naiveDaily !== null && preview.total < naiveDaily ? (
            <>
              <span className="text-text-secondary"> — beats </span>
              <Money kobo={naiveDaily} className="font-normal text-ink-400 line-through" />
            </>
          ) : null}
          <span className="text-text-secondary">)</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-s2">
        <span className="text-caption font-medium text-text-secondary">Units available</span>
        <div className="flex items-center gap-s3">
          <button
            type="button"
            aria-label="Fewer units"
            className="grid size-s6 place-items-center rounded-sm border border-border-strong text-body disabled:opacity-40"
            disabled={draft.unit_count <= 1}
            onClick={() => set("unit_count", draft.unit_count - 1)}
          >
            −
          </button>
          <span className="w-s6 text-center font-mono text-mono-lg">{draft.unit_count}</span>
          <button
            type="button"
            aria-label="More units"
            className="grid size-s6 place-items-center rounded-sm border border-border-strong text-body"
            onClick={() => set("unit_count", draft.unit_count + 1)}
          >
            +
          </button>
          <span className="text-caption text-ink-500">
            identical machines hirers can book in parallel
          </span>
        </div>
        {draft.unit_count > 1 ? (
          <div className="grid gap-s2 sm:grid-cols-2">
            {Array.from({ length: draft.unit_count }, (_, i) => (
              <TextField
                key={i}
                label={`Unit ${i + 1} label (optional)`}
                placeholder={`e.g. Reg. LAG-${100 + i}`}
                value={draft.unit_labels[i] ?? ""}
                onChange={(e) => {
                  const labels = [...draft.unit_labels];
                  labels[i] = e.target.value;
                  set("unit_labels", labels);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
