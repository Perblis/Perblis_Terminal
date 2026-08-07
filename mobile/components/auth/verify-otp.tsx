// F1's OTP step, dual-channel (Wave 1: phone AND email must verify before
// login). 6-cell mono input, 10:00 mono countdown, resend (3/hr server-side),
// wrong-code copy from the server, and the abandoned-OTP resume: this same
// component serves post-register and the login bounce. Ported from
// portal/components/auth/verify-otp.tsx.
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { ApiError } from "../../lib/api";
import { resendEmailOtp, resendPhoneOtp, verifyEmailOtp, verifyPhoneOtp } from "../../lib/auth-api";
import { Button } from "../ui/button";
import { OtpInput } from "../ui/otp-input";
import { BodyText, DisplayText, MonoText } from "../ui/text";

const OTP_TTL_SECONDS = 10 * 60;

type Channel = "phone" | "email";

export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, "0");
  return (
    <MonoText className={left === 0 ? "text-text-danger" : "text-text-secondary"}>
      {left === 0 ? "Code expired" : `${mm}:${ss}`}
    </MonoText>
  );
}

export function maskPhone(phone: string): string {
  // +2348031234567 → 0803 123 4567 (09 §2 grouped display)
  const local = phone.startsWith("+234") ? `0${phone.slice(4)}` : phone;
  return local.length === 11 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : local;
}

export function VerifyOtp({
  phone,
  email,
  startChannel = "phone",
  onVerified,
}: {
  phone: string;
  email: string;
  /** Abandoned-OTP resume can drop straight into the email step. */
  startChannel?: Channel;
  /** Called once both channels verify. */
  onVerified: () => void;
}) {
  const [channel, setChannel] = useState<Channel>(startChannel);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() => Date.now() + OTP_TTL_SECONDS * 1000);
  // Force the OTP cells to remount (clear) on channel switch or resend.
  const [inputKey, setInputKey] = useState(0);

  const target = channel === "phone" ? maskPhone(phone) : email;

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      try {
        if (channel === "phone") {
          await verifyPhoneOtp(phone, code);
          setChannel("email");
          setNotice(`Phone verified. Now the code we emailed to ${email}.`);
          setDeadline(Date.now() + OTP_TTL_SECONDS * 1000);
          setInputKey((k) => k + 1);
        } else {
          await verifyEmailOtp(email, code);
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

  const resend = async () => {
    setResendBusy(true);
    setError(null);
    try {
      if (channel === "phone") {
        await resendPhoneOtp(phone);
      } else {
        await resendEmailOtp(email);
      }
      setNotice(`Code sent to ${target}`);
      setDeadline(Date.now() + OTP_TTL_SECONDS * 1000);
      setInputKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the code. Try again.");
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <View className="gap-4">
      <View>
        <DisplayText className="text-h2">
          {channel === "phone" ? "Verify your phone" : "Verify your email"}
        </DisplayText>
        <BodyText className="mt-1 text-text-secondary">
          Enter the 6-digit code we sent to {target}.
        </BodyText>
      </View>

      {notice ? <BodyText className="text-body-sm text-text-secondary">{notice}</BodyText> : null}

      <OtpInput key={inputKey} onComplete={(code) => void submit(code)} disabled={busy} />

      {error ? <BodyText className="text-body-sm text-text-danger">{error}</BodyText> : null}

      <View className="flex-row items-center justify-between">
        <Countdown deadline={deadline} />
        <Button
          variant="ghost"
          label={resendBusy ? "Sending…" : "Resend code"}
          disabled={resendBusy || busy}
          onPress={() => void resend()}
        />
      </View>
    </View>
  );
}
