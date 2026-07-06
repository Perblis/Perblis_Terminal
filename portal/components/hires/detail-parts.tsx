"use client";

// P7 building blocks: lifecycle rail, EventTimeline (06 §1), hold-to-confirm.
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { LIFECYCLE, lifecycleIndex } from "@/lib/hire-domain";
import type { HireDetail, HireStatus7 } from "@/lib/types";

const RAIL_LABELS: Record<(typeof LIFECYCLE)[number], string> = {
  requested: "Requested",
  accepted: "Accepted",
  confirmed: "Paid",
  on_hire: "On hire",
  completed: "Completed",
} as Record<(typeof LIFECYCLE)[number], string>;

const TERMINAL_LABEL: Partial<Record<HireStatus7, string>> = {
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  in_dispute: "In dispute",
};

/** Horizontal lifecycle rail; terminal states render as a branch. */
export function LifecycleRail({ status }: { status: HireStatus7 }) {
  const reached = lifecycleIndex(status);
  const terminal = TERMINAL_LABEL[status];
  return (
    <div className="flex flex-col gap-s2">
      <ol className="flex items-center gap-s1">
        {LIFECYCLE.map((step, i) => {
          const done = !terminal && i <= reached;
          const partial = terminal && i <= reached;
          return (
            <li key={step} className="flex flex-1 items-center gap-s1">
              <span
                className={cn(
                  "grid size-s4 shrink-0 place-items-center rounded-pill border-2 text-caption",
                  done
                    ? "border-green-600 bg-green-600"
                    : partial
                      ? "border-ink-400 bg-ink-400"
                      : "border-ink-200 bg-surface-card",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "hidden whitespace-nowrap text-caption sm:block",
                  done ? "font-medium text-text-primary" : "text-ink-500",
                )}
              >
                {RAIL_LABELS[step]}
              </span>
              {i < LIFECYCLE.length - 1 ? (
                <span className={cn("h-px flex-1", i < reached && !terminal ? "bg-green-600" : "bg-ink-200")} aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
      {terminal ? (
        <p className="text-caption text-ink-500">
          ↳ ended as <span className={cn("font-medium", status === "in_dispute" ? "text-violet-900" : status === "cancelled" ? "text-red-900" : "text-ink-600")}>{terminal}</span>
        </p>
      ) : null}
    </div>
  );
}

const ACTOR_LABEL: Record<string, string> = {
  hirer: "Hirer",
  supplier: "You",
  system: "Terminal",
  ops: "Terminal Ops",
};

/** EventTimeline (06 §1): status-dot nodes, mono timestamps, collapsible >5. */
export function EventTimeline({ events }: { events: HireDetail["events"] }) {
  const [expanded, setExpanded] = useState(false);
  const ordered = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const visible = expanded ? ordered : ordered.slice(0, 5);
  return (
    <div>
      <ol className="flex flex-col">
        {visible.map((event, i) => (
          <li key={event.id} className="relative flex gap-s3 pb-s3">
            {i < visible.length - 1 ? (
              <span className="absolute left-[4px] top-s3 h-full w-[2px] bg-ink-200" aria-hidden />
            ) : null}
            <span className="relative mt-s1 size-[10px] shrink-0 rounded-pill bg-amber-500" aria-hidden />
            <div className="min-w-0">
              <p className="text-body-sm text-text-primary">
                {ACTOR_LABEL[event.actor_kind] ?? event.actor_kind} — {event.to_status.replace(/_/g, " ")}
              </p>
              <p className="font-mono text-mono-sm text-ink-500">
                {new Date(event.created_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {ordered.length > 5 ? (
        <button type="button" className="text-body-sm text-text-link underline" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show fewer" : `Show all ${ordered.length}`}
        </button>
      ) : null}
    </div>
  );
}

/** Hold-to-confirm (~1.2s fill); keyboard & reduced-motion get two-step. */
export function HoldToConfirm({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [armed, setArmed] = useState(false); // two-step fallback
  const timer = useRef<number | null>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function start() {
    if (disabled || reduced.current) return;
    const begun = Date.now();
    timer.current = window.setInterval(() => {
      const p = (Date.now() - begun) / 1_200;
      setProgress(Math.min(1, p));
      if (p >= 1) {
        stop();
        onConfirm();
      }
    }, 40);
  }
  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  }

  function keyActivate() {
    if (disabled) return;
    if (armed) {
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
      window.setTimeout(() => setArmed(false), 4_000);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), keyActivate())}
      onClick={(e) => {
        // Pointer users confirm by holding; a plain click on reduced-motion
        // (or assistive tech synthesising clicks) uses the two-step arm.
        if (reduced.current) {
          e.preventDefault();
          keyActivate();
        }
      }}
      className="relative h-12 min-w-[12rem] select-none overflow-hidden rounded-sm bg-action-primary px-s5 font-medium text-text-on-brand disabled:bg-ink-100 disabled:text-ink-400"
    >
      <span className="absolute inset-0 bg-amber-600 transition-none" style={{ width: `${progress * 100}%` }} aria-hidden />
      <span className="relative">{armed ? "Press again to confirm" : progress > 0 ? "Keep holding…" : label}</span>
    </button>
  );
}
