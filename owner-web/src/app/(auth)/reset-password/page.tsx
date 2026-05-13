"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/lib/api/auth";

function ResetPasswordForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [email] = useState(sp.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [pwd, setPwd] = useState("");

  const confirm = useMutation({
    mutationFn: () => authApi.confirmPasswordReset(email, otp, pwd),
    onSuccess: () => router.replace("/login"),
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display text-[36px] leading-none tracking-tight uppercase">
          New password
        </div>
        <p className="text-text-secondary mt-2">Enter the code and your new password.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm.mutate();
        }}
        className="space-y-5"
        noValidate
      >
        <Field id="email" label="Email">
          <Input id="email" value={email} disabled />
        </Field>

        <Field id="otp" label="OTP code">
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="text-center font-mono tracking-[0.4em]"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Field id="pwd" label="New password">
          <Input
            id="pwd"
            type="password"
            autoComplete="new-password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
        </Field>

        {confirm.error ? (
          <p className="text-alert-soft text-[13px]">{(confirm.error as Error).message}</p>
        ) : null}

        <Button
          type="submit"
          fullWidth
          size="lg"
          disabled={otp.length < 6 || pwd.length < 8 || confirm.isPending}
        >
          {confirm.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
