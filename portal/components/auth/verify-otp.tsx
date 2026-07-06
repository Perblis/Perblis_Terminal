"use client";

// F1's OTP step, dual-channel (Wave 1: phone AND email must verify before
// login). 6-cell mono input, 10:00 mono countdown, resend (3/hr server-side),
// wrong-code copy from the server, and the abandoned-OTP resume: this same
// component serves post-register and the login bounce.

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { ApiError, auth } from "@/lib/api";

const OTP_TTL_SECONDS = 10 * 60;

type Channel = "phone" | "email";

function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={left === 0 ? "font-mono text-text-danger" : "font-mono text-text-secondary"}>
      {left === 0 ? "Code expired" : `${mm}:${ss}`}
    </span>
  );
}

function maskPhone(phone: string): string {
  // +2348031234567 → 0803 123 4567 (09 §2 grouped display)
  const local = phone.startsWith("+234") ? `0${phone.slice(4)}` : phone;
  return local.length === 11 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : local;
}

export function VerifyOtp({
  phone,
  email,
  onVerified,
}: {
  phone: string;
  email: string;
  /** Called once both channels verify. */
  onVerified: () => void;
}) {
  const [channel, setChannel] = useState<Channel>("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() => Date.now() + OTP_TTL_SECONDS * 1000);
  // Force the OTP cells to remount (clear) on channel switch or resend.
  const [inputKey, setInputKey] = useState(0);
  const verifiedPhone = useRef(false);

  const target = channel === "phone" ? maskPhone(phone) : email;

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      try {
        if (channel === "phone") {
          await auth("/otp/verify", { phone, code });
          verifiedPhone.current = true;
          setChannel("email");
          setNotice(`Phone verified. Now the code we emailed to ${email}.`);
          setDeadline(Date.now() + OTP_TTL_SECONDS * 1000);
          setInputKey((k) => k + 1);
        } else {
          await auth("/email/verify", { email, code });
          onVerified();
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "That code didn't match. Try again.");
        setInputKey((k) => k + 1);
      } finally {
        setBusy(false);
      }
    },
    [channel, phone, email, onVerified],
  );

  async function resend() {
    setResendBusy(true);
    setError(null);
    try {
      if (channel === "phone") {
        await auth("/otp/resend", { phone });
      } else {
        await auth("/email/resend", { email });
      }
      setNotice(`Code sent to ${target}`);
      setDeadline(Date.now() + OTP_TTL_SECONDS * 1000);
      setInputKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the code. Try again.");
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-s4">
      <div>
        <h1 className="font-display text-h2 text-text-primary">
          {channel === "phone" ? "Verify your phone" : "Verify your email"}
        </h1>
        <p className="mt-s1 text-body-sm text-text-secondary">
          {notice ?? `Code sent to ${target}`}
        </p>
      </div>

      <OtpInput key={inputKey} onComplete={submit} disabled={busy} error={Boolean(error)} />

      {error ? (
        <p className="text-body-sm text-text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between text-body-sm">
        <Countdown deadline={deadline} />
        <Button variant="ghost" size="sm" onClick={resend} loading={resendBusy}>
          Resend code
        </Button>
      </div>

      <div className="flex items-center gap-s2 text-caption text-ink-500">
        <span
          className={
            channel === "email" || verifiedPhone.current
              ? "size-s2 rounded-pill bg-green-600"
              : "size-s2 rounded-pill bg-amber-500"
          }
          aria-hidden
        />
        <span>Step {channel === "phone" ? "1 of 2 — SMS code" : "2 of 2 — email code"}</span>
      </div>
    </div>
  );
}
