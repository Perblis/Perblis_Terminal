// Pin system per 06 §3. Anatomy is normative; the V5 feel (spring drop,
// crosshair select ring, haptic tick) is applied by TerminalMap around
// these — the components themselves are static and testable.
import { Image, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "@terminal/tokens";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { useThemeTokens } from "../../lib/theme";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import type { MapYard, MapSoloListing } from "../../lib/types";
import { MonoText, BodyText } from "../ui/text";

const useMapTokens = useThemeTokens;

/** WCAG relative luminance of a #RRGGBB value. */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ink glyph on light class fills, paper glyph on dark ones — a fixed white
 * glyph fails non-text contrast on the amber/green 500 fills the dark theme
 * uses (e.g. white on amber-500 ≈ 2.1:1).
 */
function glyphColorFor(fill: string): string {
  return luminance(fill) > 0.2 ? tokens.color.colorInk900 : tokens.color.colorPaper0;
}

/** 32px class-coloured teardrop with the paper class glyph (06 §3). */
export function AssetPin({ listing, selected = false }: { listing: MapSoloListing; selected?: boolean }) {
  const t = useMapTokens();
  const meta = CLASS_BY_VALUE[listing.asset_class];
  const fill = t[meta.varKey];
  const Glyph = CLASS_GLYPHS[listing.asset_class];
  const size = selected ? 38 : 32;
  return (
    <View
      accessibilityLabel={`${meta.label} listing: ${listing.title}`}
      style={{ width: size, height: size * 1.35, alignItems: "center" }}
    >
      <Svg width={size} height={size * 1.35} viewBox="0 0 32 43">
        <Path
          d="M16 1 C24.3 1 31 7.7 31 16 C31 27 16 42 16 42 S1 27 1 16 C1 7.7 7.7 1 16 1 Z"
          fill={fill}
          stroke={selected ? t["--surface-brand"] : t["--surface-inverse"]}
          strokeWidth={selected ? 2.5 : 1}
        />
      </Svg>
      <View style={{ position: "absolute", top: size * 0.22 }}>
        <Glyph size={size * 0.5} color={glyphColorFor(fill)} />
      </View>
    </View>
  );
}

/**
 * 40px squircle yard pin: logo (or ink+amber initials), amber count badge
 * (matching_count when filtered), ≤3 class dots, verification tick on the
 * border; matching_count 0 ⇒ whole pin at 40%, never removed.
 */
export function YardPin({
  yard,
  filtered = false,
  selected = false,
}: {
  yard: MapYard;
  filtered?: boolean;
  selected?: boolean;
}) {
  const t = useMapTokens();
  const dimmed = filtered && yard.matching_count === 0;
  const count = filtered ? yard.matching_count : yard.listing_count;
  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View
      accessibilityLabel={`Yard: ${yard.name}, ${count} listings`}
      style={{ width: 52, height: 52, opacity: dimmed ? 0.4 : 1 }}
    >
      <View
        className="items-center justify-center overflow-hidden bg-surface-inverse"
        style={{
          width: 40,
          height: 40,
          marginTop: 8,
          borderRadius: 13,
          borderWidth: selected ? 2 : 1.5,
          borderColor: selected ? t["--surface-brand"] : t["--surface-inverse"],
        }}
      >
        {yard.supplier.logo ? (
          <Image source={{ uri: yard.supplier.logo }} style={{ width: 40, height: 40 }} />
        ) : (
          <MonoText style={{ color: t["--text-brand-on-inverse"], fontSize: 14 }}>{initials}</MonoText>
        )}
      </View>
      {/* count badge */}
      <View
        className="absolute right-0 top-0 items-center justify-center rounded-full bg-surface-brand"
        style={{ minWidth: 20, height: 20, paddingHorizontal: 4 }}
      >
        <MonoText className="text-text-on-brand" style={{ fontSize: 11 }}>
          {count}
        </MonoText>
      </View>
      {/* verification tick */}
      {yard.supplier.badge ? (
        <View
          className="absolute items-center justify-center rounded-full"
          style={{ left: -2, top: 6, width: 16, height: 16, backgroundColor: tokens.color.colorBlue600 }}
        >
          <Svg width={10} height={10} viewBox="0 0 24 24">
            <Path d="M4 12l6 6 10 -12" stroke={tokens.color.colorPaper0} strokeWidth={3.5} fill="none" />
          </Svg>
        </View>
      ) : null}
      {/* ≤3 class dots */}
      <View className="mt-0.5 flex-row justify-center gap-1" style={{ width: 40 }}>
        {yard.class_mix.slice(0, 3).map((c) => (
          <View
            key={c}
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: t["--surface-card"],
              backgroundColor: t[CLASS_BY_VALUE[c].varKey],
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** 36px ink-700 circle, paper mono count — deliberately drab (06 §3). */
export function ClusterPin({ count }: { count: number }) {
  const t = useMapTokens();
  return (
    <View
      accessibilityLabel={`${count} listings — zoom in`}
      className="items-center justify-center rounded-full"
      style={{ width: 36, height: 36, backgroundColor: tokens.color.colorInk700, borderWidth: 1, borderColor: t["--surface-card"] }}
    >
      <MonoText style={{ color: tokens.color.colorPaper0, fontSize: 13 }}>{count}</MonoText>
    </View>
  );
}

/** Crosshair select ring — the chart-instrument selection detail (V5). */
export function CrosshairRing({ size = 56 }: { size?: number }) {
  const t = useMapTokens();
  const c = size / 2;
  const amber = t["--surface-brand"];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      <Circle cx={c} cy={c} r={c - 4} stroke={amber} strokeWidth={1.5} fill="none" strokeDasharray="4 5" />
      <Path d={`M${c} 0 V7 M${c} ${size - 7} V${size} M0 ${c} H7 M${size - 7} ${c} H${size}`} stroke={amber} strokeWidth={1.5} />
    </Svg>
  );
}

/** Peek-card availability caption text helper (S4). */
export function availabilityCaption(listing: MapSoloListing | { available: boolean }): string {
  return listing.available ? "Available now" : "Currently on hire";
}

// Re-export for pin consumers that only need text.
export { BodyText };
