"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import { VerifyOtp } from "@/components/auth/verify-otp";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { ApiError, auth } from "@/lib/api";
import { loginSchema, normalizeNgPhone, type LoginInput } from "@/lib/auth-schemas";

// P1 sign-in. The F1 resume branch lives here: a login rejected with
// phone_not_verified / email_not_verified drops into the OTP step with the
// just-typed credentials held in memory, then retries the login untouched.

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [resume, setResume] = useState<{ email: string; password: string; phone: string } | null>(null);
  const [needPhone, setNeedPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function completeLogin(email: string, password: string) {
    await auth("/login", { email, password });
    router.replace("/dashboard");
  }

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await completeLogin(values.email, values.password);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "phone_not_verified" || e.code === "email_not_verified")) {
        // Abandoned mid-OTP at registration — resume the verify step (F1).
        setNeedPhone(true);
        return;
      }
      if (e instanceof ApiError && e.code === "account_suspended") {
        router.replace("/suspended");
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Sign-in failed. Try again.");
    }
  }

  if (resume) {
    return (
      <VerifyOtp
        phone={resume.phone}
        email={resume.email}
        onVerified={() => {
          void completeLogin(resume.email, resume.password).catch(() =>
            setFormError("Verified — but sign-in failed. Try again."),
          );
          setResume(null);
        }}
      />
    );
  }

  if (needPhone) {
    // The login error doesn't carry the phone; confirm it once to resend OTPs.
    return (
      <form
        className="flex flex-col gap-s4"
        onSubmit={async (e) => {
          e.preventDefault();
          const phone = normalizeNgPhone(phoneInput);
          const { email, password } = getValues();
          setFormError(null);
          try {
            await auth("/otp/resend", { phone });
            await auth("/email/resend", { email }).catch(() => undefined);
            setResume({ email, password, phone });
            setNeedPhone(false);
          } catch (err) {
            setFormError(err instanceof ApiError ? err.message : "Couldn't send the code. Try again.");
          }
        }}
      >
        <div>
          <h1 className="font-display text-h2 text-text-primary">Finish verifying your account</h1>
          <p className="mt-s1 text-body-sm text-text-secondary">
            Your account exists but isn&apos;t verified yet. Confirm your phone number and
            we&apos;ll send fresh codes.
          </p>
        </div>
        <TextField
          label="Phone number"
          prefix="+234"
          placeholder="803 123 4567"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          error={formError ?? undefined}
        />
        <Button type="submit" size="lg" className="w-full">
          Send codes
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-s4" noValidate>
      <div>
        <h1 className="font-display text-h2 text-text-primary">Sign in</h1>
        <p className="mt-s1 text-body-sm text-text-secondary">
          Run your fleet — requests, money, messages, one place.
        </p>
      </div>

      {params.get("verified") ? (
        <Banner tone="info">Account verified. Sign in to get started.</Banner>
      ) : null}
      {formError ? <Banner tone="danger">{formError}</Banner> : null}

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Sign in
      </Button>

      <p className="text-body-sm text-text-secondary">
        New to Terminal?{" "}
        <Link href="/register" className="text-text-link underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
