"use client";

import { Rows2, Rows4 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

import { applyDensity, readDensity, type Density } from "./preferences";

/** Global density toggle (04 §4) — comfortable default, persisted. */
export function DensityToggle({ collapsed }: { collapsed: boolean }) {
  const [density, setDensity] = useState<Density>("comfortable");
  useEffect(() => setDensity(readDensity()), []);

  const next: Density = density === "comfortable" ? "compact" : "comfortable";
  return (
    <button
      type="button"
      onClick={() => {
        applyDensity(next);
        setDensity(next);
      }}
      title={`Switch to ${next} density`}
      aria-label={`Switch to ${next} density`}
      className={cn(
        "flex h-10 w-full items-center gap-s3 rounded-sm px-s3 text-body-sm text-ink-300",
        "transition-colors duration-quick hover:bg-ink-800 hover:text-text-inverse",
        collapsed && "justify-center px-0",
      )}
    >
      {density === "comfortable" ? <Rows2 size={18} aria-hidden /> : <Rows4 size={18} aria-hidden />}
      {collapsed ? null : <span>{density === "comfortable" ? "Comfortable" : "Compact"}</span>}
    </button>
  );
}
