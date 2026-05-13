"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/lib/api/auth";
import { loadTokensFromStorage } from "@/lib/api/client";
import { QUERY_KEYS } from "@/lib/constants";

export default function VerifyPhonePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  useEffect(() => {
    loadTokensFromStorage();
  }, []);

  const verify = useMutation({
    mutationFn: (otp: string) => authApi.verifyPhone(otp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
      router.replace("/dashboard");
    },
  });

  const resend = useMutation({ mutationFn: () => authApi.resendOtp() });

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display text-[36px] leading-none tracking-tight uppercase">
          Verify phone
        </div>
        <p className="text-text-secondary mt-2">Enter the 6-digit code we sent to your phone.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify.mutate(code);
        }}
        className="space-y-5"
      >
        <Field
          id="otp"
          label="OTP code"
          error={verify.error ? (verify.error as Error).message : undefined}
        >
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="text-center font-mono text-[20px] tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <Button type="submit" fullWidth size="lg" disabled={code.length < 6 || verify.isPending}>
          {verify.isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-[13px]">
        <span className="text-text-tertiary">Didn&apos;t get a code?</span>
        <button
          type="button"
          onClick={() => resend.mutate()}
          className="text-forge disabled:opacity-40"
          disabled={resend.isPending || resend.isSuccess}
        >
          {resend.isSuccess ? "Sent." : resend.isPending ? "Sending…" : "Resend"}
        </button>
      </div>
    </div>
  );
}
