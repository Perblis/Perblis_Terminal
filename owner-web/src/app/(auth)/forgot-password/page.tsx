"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const reset = useMutation({
    mutationFn: () => authApi.requestPasswordReset(email),
    onSuccess: () => {
      router.replace(`/reset-password?email=${encodeURIComponent(email)}`);
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display text-[36px] leading-none tracking-tight uppercase">
          Reset password
        </div>
        <p className="text-text-secondary mt-2">
          We will send a 6-digit code to the email on file.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
        className="space-y-5"
        noValidate
      >
        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {reset.error ? (
          <p className="text-alert-soft text-[13px]">{(reset.error as Error).message}</p>
        ) : null}

        <Button type="submit" fullWidth size="lg" disabled={!email || reset.isPending}>
          {reset.isPending ? "Sending…" : "Send code"}
        </Button>
      </form>

      <p className="text-text-secondary text-center text-[13px]">
        Remembered it?{" "}
        <Link href="/login" className="text-forge">
          Sign in
        </Link>
      </p>
    </div>
  );
}
