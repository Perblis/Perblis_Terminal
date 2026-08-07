import { useEffect, useState } from "react";

export type CountdownParts = {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  /** "3h 12m" / "12:04" / "0:59" — the 07 §10 deadline vocabulary. */
  label: string;
};

export function countdownParts(deadlineIso: string, nowMs: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label =
    hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  return { totalSeconds, hours, minutes, seconds, expired: totalSeconds === 0, label };
}

/** Ticks every second toward an ISO deadline (24h request / 4h payment windows). */
export function useCountdown(deadlineIso: string | null | undefined): CountdownParts | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineIso) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [deadlineIso]);
  if (!deadlineIso) return null;
  return countdownParts(deadlineIso, now);
}
