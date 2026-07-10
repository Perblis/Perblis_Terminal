"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/cn";

/** Text fields per 05 §2 — label always above, helper/error 13px below. */
export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
  error?: string;
  /** Rendered inside the field's left edge (e.g. the +234 phone prefix). */
  prefix?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helper, error, prefix, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className={cn("flex flex-col gap-s1", className)}>
      <label htmlFor={id} className="text-caption font-medium text-text-secondary">
        {label}
      </label>
      <div
        className={cn(
          "flex h-10 items-center overflow-hidden rounded-sm border bg-surface-card",
          error ? "border-border-error" : "border-border-default",
          rest.disabled && "bg-ink-50",
        )}
      >
        {prefix ? (
          <span className="flex h-full items-center border-r border-border-default bg-surface-sunken px-s3 font-mono text-body-sm text-text-secondary">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full w-full bg-transparent px-s3 text-body-sm text-text-primary outline-none placeholder:text-ink-500 disabled:cursor-not-allowed"
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-caption text-text-danger" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-caption text-text-tertiary">
          {helper}
        </p>
      ) : null}
    </div>
  );
});

/** Password field with the 05 §2 visibility toggle. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, "type">>(
  function PasswordField({ ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <TextField ref={ref} type={visible ? "text" : "password"} {...rest} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-s2 top-[26px] grid size-s6 place-items-center rounded-sm text-ink-500 hover:text-text-primary"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  },
);
