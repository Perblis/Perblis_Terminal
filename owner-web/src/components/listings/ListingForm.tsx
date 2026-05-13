"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/constants";

// Accept "", null, undefined, number, or numeric string. After preprocess
// the validated type is `number | undefined`, so RHF's input/output shapes
// stay aligned and zodResolver doesn't complain about resolver mismatch.
const optionalNumber = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}, z.number().optional());

const schema = z.object({
  resource_type: z.enum(RESOURCE_TYPES),
  title: z.string().min(3, "Required."),
  description: z.string().min(20, "Describe the asset — 20 characters minimum."),
  category: z.string().optional(),
  price_daily: optionalNumber,
  price_weekly: optionalNumber,
  price_monthly: optionalNumber,
  location_address: z.string().optional(),
  location_city: z.string().optional(),
  latitude: optionalNumber.refine(
    (v) => v === undefined || (v >= -90 && v <= 90),
    { message: "Latitude must be between -90 and 90." },
  ),
  longitude: optionalNumber.refine(
    (v) => v === undefined || (v >= -180 && v <= 180),
    { message: "Longitude must be between -180 and 180." },
  ),
  operator_available: z.boolean().optional(),
  delivery_available: z.boolean().optional(),
});

// The Zod schema accepts loose form input (strings from <input>) and produces
// a strongly-typed output (number | undefined). Thread both through RHF so
// `onSubmit` receives the transformed shape.
type FormInput = z.input<typeof schema>;
export type ListingFormValues = z.output<typeof schema>;

export function ListingForm({
  defaults,
  submitting,
  submitLabel,
  onSubmit,
}: {
  defaults?: Partial<ListingFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: ListingFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, ListingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      resource_type: (defaults?.resource_type as ResourceType) ?? "equipment",
      operator_available: false,
      delivery_available: false,
      ...defaults,
    } as FormInput,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-[720px] space-y-8" noValidate>
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Basics</h2>
        <Field id="resource_type" label="Resource type" error={errors.resource_type?.message}>
          <select
            id="resource_type"
            className="border-border bg-surface-elevated h-10 w-full rounded border px-3 text-[14px]"
            {...register("resource_type")}
          >
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field id="title" label="Title" error={errors.title?.message}>
          <Input id="title" invalid={!!errors.title} {...register("title")} />
        </Field>

        <Field id="description" label="Description" error={errors.description?.message}>
          <textarea
            id="description"
            rows={6}
            className="border-border bg-surface-elevated font-body text-text-primary placeholder:text-text-tertiary focus:border-border-active w-full rounded border p-3 text-[14px] focus:outline-none"
            {...register("description")}
          />
        </Field>

        <Field id="category" label="Category" hint="Free text e.g. mobile crane, flatbed 30t.">
          <Input id="category" {...register("category")} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Pricing</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field id="price_daily" label="Daily (₦)">
            <Input
              id="price_daily"
              inputMode="numeric"
              className="font-mono"
              {...register("price_daily")}
            />
          </Field>
          <Field id="price_weekly" label="Weekly (₦)">
            <Input
              id="price_weekly"
              inputMode="numeric"
              className="font-mono"
              {...register("price_weekly")}
            />
          </Field>
          <Field id="price_monthly" label="Monthly (₦)">
            <Input
              id="price_monthly"
              inputMode="numeric"
              className="font-mono"
              {...register("price_monthly")}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Location</h2>
        <p className="text-text-tertiary text-[12px]">
          Location is required to activate the listing. Mapbox picker arrives in Wave 06; enter
          coordinates directly for now.
        </p>
        <Field id="location_address" label="Address">
          <Input id="location_address" {...register("location_address")} />
        </Field>
        <Field id="location_city" label="City">
          <Input id="location_city" {...register("location_city")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="latitude" label="Latitude" error={errors.latitude?.message}>
            <Input
              id="latitude"
              inputMode="decimal"
              className="font-mono"
              {...register("latitude")}
            />
          </Field>
          <Field id="longitude" label="Longitude" error={errors.longitude?.message}>
            <Input
              id="longitude"
              inputMode="decimal"
              className="font-mono"
              {...register("longitude")}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Options</h2>
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" {...register("operator_available")} />
          Operator can be provided
        </label>
        <label className="flex items-center gap-3 text-[14px]">
          <input type="checkbox" {...register("delivery_available")} />
          Delivery available
        </label>
      </section>

      <div className="pt-2">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
