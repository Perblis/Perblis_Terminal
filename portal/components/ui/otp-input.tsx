"use client";

// OTP input per 05 §2: six 48×56 mono cells, auto-advance, paste-aware.
import { useRef, useState } from "react";

import { cn } from "@/lib/cn";

const LENGTH = 6;

export function OtpInput({
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
}: {
  onComplete: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string[]) {
    setDigits(next);
    const code = next.join("");
    if (code.length === LENGTH) onComplete(code);
  }

  function handleChange(index: number, raw: string) {
    const value = raw.replace(/\D/g, "");
    if (!value) {
      commit(digits.map((d, i) => (i === index ? "" : d)));
      return;
    }
    // Paste-aware: distribute every digit typed or pasted from this cell on.
    const next = [...digits];
    for (let i = 0; i < value.length && index + i < LENGTH; i += 1) {
      next[index + i] = value[i];
    }
    commit(next);
    cells.current[Math.min(index + value.length, LENGTH - 1)]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      cells.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) cells.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < LENGTH - 1) cells.current[index + 1]?.focus();
  }

  return (
    <div className="flex gap-s2" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-12 rounded-sm border bg-surface-card text-center font-mono text-xl text-text-primary",
            "outline-none transition-colors duration-micro",
            error ? "border-border-error" : "border-border-default focus:border-border-strong",
            disabled && "bg-ink-50 text-ink-400",
          )}
        />
      ))}
    </div>
  );
}
