"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { VerifyOtp } from "@/components/auth/verify-otp";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { ApiError, auth } from "@/lib/api";
import { registerSchema, type RegisterInput } from "@/lib/auth-schemas";

// P1 registration → inline OTP (F1). Credentials stay in memory through the
// verify step so the finish line is the dashboard, not another sign-in form.

export default function RegisterPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicatePhone, setDuplicatePhone] = useState(false);
  const [verifying, setVerifying] = useState<RegisterInput | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    setDuplicatePhone(false);
    try {
      await auth("/register", values);
      setVerifying(values);
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        for (const [field, messages] of Object.entries(e.fields)) {
          if (field === "phone" && messages.some((m) => m.includes("already exists"))) {
            setDuplicatePhone(true);
          }
          if (field in values) {
            setError(field as keyof RegisterInput, { message: messages[0] });
          }
        }
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Registration failed. Try again.");
    }
  }

  if (verifying) {
    return (
      <VerifyOtp
        phone={verifying.phone}
        email={verifying.email}
        onVerified={() => {
          void auth("/login", { email: verifying.email, password: verifying.password })
            .then(() => router.replace("/dashboard"))
            .catch(() => router.replace("/login?verified=1"));
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-s4" noValidate>
      <div>
        <h1 className="font-display text-h2 text-text-primary">Create your account</h1>
        <p className="mt-s1 text-body-sm text-text-secondary">
          List your fleet and take hires through Terminal.
        </p>
      </div>

      {formError ? <Banner tone="danger">{formError}</Banner> : null}

      <TextField
        label="Full name"
        autoComplete="name"
        placeholder="Adaeze Okafor"
        error={errors.full_name?.message}
        {...register("full_name")}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <div>
        <TextField
          label="Phone number"
          prefix="+234"
          inputMode="tel"
          autoComplete="tel"
          placeholder="803 123 4567"
          helper="We'll text a 6-digit code to verify it."
          error={errors.phone?.message}
          {...register("phone")}
        />
        {duplicatePhone ? (
          <p className="mt-s1 text-body-sm text-text-secondary">
            That number already has an account.{" "}
            <Link href="/login" className="text-text-link underline">
              Sign in instead
            </Link>
          </p>
        ) : null}
      </div>
      <PasswordField
        label="Password"
        autoComplete="new-password"
        helper="At least 8 characters with an uppercase letter and a number."
        error={errors.password?.message}
        {...register("password")}
      />

      <label className="flex items-start gap-s2 text-body-sm text-text-secondary">
        <input
          type="checkbox"
          className="mt-s1 size-s4 accent-amber-500"
          {...register("accept_tos")}
        />
        <span>
          I accept the <span className="underline">Terms of Service</span>
        </span>
      </label>
      <label className="flex items-start gap-s2 text-body-sm text-text-secondary">
        <input
          type="checkbox"
          className="mt-s1 size-s4 accent-amber-500"
          {...register("accept_privacy")}
        />
        <span>
          I accept the <span className="underline">Privacy Policy</span> (NDPR)
        </span>
      </label>
      {errors.accept_tos || errors.accept_privacy ? (
        <p className="text-body-sm text-text-danger" role="alert">
          {errors.accept_tos?.message ?? errors.accept_privacy?.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Create account
      </Button>

      <p className="text-body-sm text-text-secondary">
        Already on Terminal?{" "}
        <Link href="/login" className="text-text-link underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
