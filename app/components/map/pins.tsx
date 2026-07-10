// Pin system, industrial-plate revision (D-023): squared ink equipment-tag
// markers — mono type, amber accents, no teardrops, no motion. Plates are
// FIXED ink (like the tab shell and PlateLockup) so they read identically on
// the light and dark Terminal Chart. Anatomy stays static and testable; the
// map layer adds no entrance animation (serious instrument posture).
import { Image, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "@terminal/tokens";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { resolveMediaUrl } from "../../lib/media";
import { useThemeTokens } from "../../lib/theme";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import type { MapYard, MapSoloListing } from "../../lib/types";
import { MonoText, BodyText } from "../ui/text";

const INK = tokens.color.colorInk900;
const PLATE_BORDER = tokens.color.colorInk400;
const AMBER = tokens.color.colorAmber500;
const PAPER = tokens.color.colorPaper0;

/** Shared plate frame: ink field, hairline border, amber when selected. */
function plateFrame(selected: boolean) {
  return {
    backgroundColor: INK,
    borderRadius: 4,
    borderWidth: selected ? 2 : 1,
    borderColor: selected ? AMBER : PLATE_BORDER,
  } as const;
}

/**
 * Solo asset plate: 26px ink square, class-coloured edge strip, paper glyph.
 * The class hue is an index mark, not the body of the pin (D-023).
 */
export function AssetPin({ listing, selected = false }: { listing: MapSoloListing; selected?: boolean }) {
  const t = useThemeTokens();
  const meta = CLASS_BY_VALUE[listing.asset_class];
  const strip = t[meta.varKey];
  const Glyph = CLASS_GLYPHS[listing.asset_class];
  const size = selected ? 30 : 26;
  return (
    <View
      accessibilityLabel={`${meta.label} listing: ${listing.title}`}
      style={{
        width: size,
        height: size,
        flexDirection: "row",
        overflow: "hidden",
        ...plateFrame(selected),
      }}
    >
      <View style={{ width: 3, backgroundColor: strip }} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Glyph size={size * 0.55} color={PAPER} />
      </View>
    </View>
  );
}

/**
 * Yard plate: ink tag with amber mono initials (or logo), a rule-separated
 * paper count (matching_count when filtered), verification tick on the
 * corner, ≤3 class index squares under the plate; matching_count 0 ⇒ whole
 * plate at 40%, never removed.
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
  const t = useThemeTokens();
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
      style={{ alignItems: "center", opacity: dimmed ? 0.4 : 1 }}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch", height: 30, overflow: "hidden", ...plateFrame(selected) }}>
        {yard.supplier.logo ? (
          <Image source={{ uri: resolveMediaUrl(yard.supplier.logo) }} style={{ width: 28, height: 28 }} />
        ) : (
          <View style={{ justifyContent: "center", paddingHorizontal: 7 }}>
            <MonoText style={{ color: AMBER, fontSize: 13 }}>{initials}</MonoText>
          </View>
        )}
        <View style={{ width: 1, backgroundColor: tokens.color.colorInk700 }} />
        <View style={{ justifyContent: "center", paddingHorizontal: 7 }}>
          <MonoText style={{ color: PAPER, fontSize: 13 }}>{count}</MonoText>
        </View>
      </View>
      {/* verification tick */}
      {yard.supplier.badge ? (
        <View
          style={{
            position: "absolute",
            right: -5,
            top: -5,
            width: 13,
            height: 13,
            borderRadius: 3,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.color.colorBlue600,
          }}
        >
          <Svg width={9} height={9} viewBox="0 0 24 24">
            <Path d="M4 12l6 6 10 -12" stroke={PAPER} strokeWidth={3.5} fill="none" />
          </Svg>
        </View>
      ) : null}
      {/* ≤3 class index squares */}
      <View style={{ flexDirection: "row", gap: 3, marginTop: 3 }}>
        {yard.class_mix.slice(0, 3).map((c) => (
          <View
            key={c}
            style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: t[CLASS_BY_VALUE[c].varKey] }}
          />
        ))}
      </View>
    </View>
  );
}

/** 26px ink-700 plate, paper mono count — deliberately drab (06 §3). */
export function ClusterPin({ count }: { count: number }) {
  return (
    <View
      accessibilityLabel={`${count} listings — zoom in`}
      style={{
        minWidth: 26,
        height: 26,
        paddingHorizontal: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: PLATE_BORDER,
        backgroundColor: tokens.color.colorInk700,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MonoText style={{ color: PAPER, fontSize: 12 }}>{count}</MonoText>
    </View>
  );
}

/** Peek-card availability caption text helper (S4). */
export function availabilityCaption(listing: MapSoloListing | { available: boolean }): string {
  return listing.available ? "Available now" : "Currently on hire";
}

// Re-export for pin consumers that only need text.
export { BodyText };
