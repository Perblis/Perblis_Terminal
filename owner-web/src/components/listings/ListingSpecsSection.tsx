"use client";

import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";

import type { ResourceType } from "@/lib/constants";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SPECS_BY_RESOURCE, type SpecField } from "./listingSpecConfig";
import type { ListingFormInput } from "./ListingForm";

function fieldError(
  errors: FieldErrors<ListingFormInput> | undefined,
  key: string,
): string | undefined {
  const specsErr = errors?.specs;
  if (!specsErr || typeof specsErr !== "object") return undefined;
  const e = specsErr as Record<string, { message?: string } | undefined>;
  return e[key]?.message;
}

function renderField(
  f: SpecField,
  register: UseFormRegister<ListingFormInput>,
  errors: FieldErrors<ListingFormInput> | undefined,
) {
  const name = `specs.${f.key}` as Path<ListingFormInput>;
  const err = fieldError(errors, f.key);

  if (f.type === "boolean") {
    return (
      <label key={f.key} className="flex items-center gap-3 text-[14px]">
        <input type="checkbox" {...register(name)} />
        <span>
          <span className="text-text-primary">{f.label}</span>
          {f.hint ? (
            <span className="text-text-tertiary block text-[12px] font-normal">{f.hint}</span>
          ) : null}
        </span>
      </label>
    );
  }

  if (f.type === "select" && f.options) {
    return (
      <Field key={f.key} id={name} label={f.label} hint={f.hint} error={err}>
        <select
          id={name}
          className="border-border bg-surface-elevated h-10 w-full rounded border px-3 text-[14px]"
          {...register(name)}
        >
          {f.options.map((o) => (
            <option key={o.value || "__empty"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (f.type === "number") {
    return (
      <Field key={f.key} id={name} label={f.label} hint={f.hint} error={err}>
        <Input
          id={name}
          inputMode="decimal"
          className="font-mono"
          {...register(name)}
        />
      </Field>
    );
  }

  return (
    <Field key={f.key} id={name} label={f.label} hint={f.hint} error={err}>
      <Input id={name} {...register(name)} />
    </Field>
  );
}

export function ListingSpecsSection({
  resourceType,
  register,
  errors,
}: {
  resourceType: ResourceType;
  register: UseFormRegister<ListingFormInput>;
  errors: FieldErrors<ListingFormInput> | undefined;
}) {
  const fields = SPECS_BY_RESOURCE[resourceType];
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase">Asset specifications</h2>
        <p className="text-text-tertiary mt-1 text-[12px]">
          Fields below apply to <span className="font-mono">{resourceType}</span> listings. Optional
          unless your team policy says otherwise.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((f) => renderField(f, register, errors))}
      </div>
    </section>
  );
}
