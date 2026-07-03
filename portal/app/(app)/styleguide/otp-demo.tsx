"use client";

import { OtpInput } from "@/components/ui/otp-input";

export function OtpDemo() {
  return (
    <div className="flex flex-col gap-s2">
      <p className="text-caption font-medium text-text-secondary">OTP — 6 mono cells</p>
      <OtpInput onComplete={() => undefined} autoFocus={false} />
    </div>
  );
}
