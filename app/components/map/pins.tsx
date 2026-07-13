// Pin system, industrial-plate revision (D-023): squared ink equipment-tag
// markers — mono type, amber accents, no teardrops, no motion. Plates are
// FIXED ink (like the tab shell and PlateLockup) so they read identically on
// the light and dark Terminal Chart. Anatomy stays static and testable; the
// map layer adds no entrance animation (serious instrument posture).
//
// Glance revision (founder, 2026-07-11): plates answer "what does this pin
// offer?" without a tap — solo plates carry the compact from-price, yard
// plates swap the abstract class squares for real class glyphs and gain a
// from-price row; unavailable solos dim like zero-match yards (never removed).
//
// Price-first revision (founder, 2026-07-13): every plate leads with the
// from-price — the one datum a hirer decides on — matching the map-
// marketplace convention (Airbnb/Zillow price pills). Compact yard plates
// show price | count instead of initials | count (two-letter initials read
// as class codes and collide across suppliers); identity stays on the
// detailed/selected plate. The verification tick renders only there too,
// as a circular seal — a floating rounded square on every compact pin read
// as a field of checkboxes.
import { Image, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { tokens } from "@terminal/tokens";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { resolveMediaUrl } from "../../lib/media";
import { compactNaira } from "../../lib/naira";
import { useThemeTokens } from "../../lib/theme";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import type { MapYard, MapSoloListing } from "../../lib/types";
import { MonoText, BodyText } from "../ui/text";

const INK = tokens.color.colorInk900;
const INK_RULE = tokens.color.colorInk700;
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
 * Solo asset plate: ink tag with the class-coloured edge strip, paper glyph,
 * and the compact from-price — price stays on the compact plate too (the pin
 * answers "what does this cost?" at a glance). On-hire listings dim to 45%
 * (like zero-match yards — informative, never removed). The class hue stays
 * an index mark, not the body of the pin (D-023).
 */
export function AssetPin({
  listing,
  selected = false,
  compact = false,
}: {
  listing: MapSoloListing;
  selected?: boolean;
  /** Carousel mode: the plate shrinks but keeps its price (the selected pin
   *  keeps the full plate + amber border). */
  compact?: boolean;
}) {
  const t = useThemeTokens();
  const meta = CLASS_BY_VALUE[listing.asset_class];
  const strip = t[meta.varKey];
  const Glyph = CLASS_GLYPHS[listing.asset_class];
  const small = compact && !selected;
  const height = selected ? 28 : compact ? 22 : 24;
  return (
    <View
      accessibilityLabel={`${meta.label} listing: ${listing.title}, from ${listing.price_from_display} a day${listing.available ? "" : ", currently on hire"}`}
      style={{
        height,
        flexDirection: "row",
        alignItems: "stretch",
        overflow: "hidden",
        opacity: listing.available ? 1 : 0.45,
        ...plateFrame(selected),
      }}
    >
      <View style={{ width: 3, backgroundColor: strip }} />
      <View style={{ justifyContent: "center", paddingLeft: 5 }}>
        <Glyph size={small ? 11 : 13} color={PAPER} />
      </View>
      {listing.price_from > 0 ? (
        <View style={{ justifyContent: "center", paddingHorizontal: 5 }}>
          <MonoText style={{ color: PAPER, fontSize: small ? 10 : 11 }}>
            {compactNaira(listing.price_from)}
          </MonoText>
        </View>
      ) : (
        <View style={{ width: 5 }} />
      )}
    </View>
  );
}

/**
 * Yard plate. Compact (unselected on the map): price-first — paper from-
 * price, rule, count (matching_count when filtered); initials only when
 * there is no price. Detailed (selected / non-compact): logo/amber initials,
 * rule, count, rule, ≤3 paper class glyphs — over an amber from-price row —
 * with the circular verification seal on the corner. matching_count 0 ⇒
 * whole plate at 40%, never removed.
 */
export function YardPin({
  yard,
  filtered = false,
  selected = false,
  compact = false,
}: {
  yard: MapYard;
  filtered?: boolean;
  selected?: boolean;
  /** Carousel mode: drop the price row and class glyphs — initials + count
   *  only (the yard card carries the detail). */
  compact?: boolean;
}) {
  const dimmed = filtered && yard.matching_count === 0;
  const count = filtered ? yard.matching_count : yard.listing_count;
  const showDetail = !compact || selected;
  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const glyphClasses = yard.class_mix.slice(0, 3);
  return (
    <View
      accessibilityLabel={`Yard: ${yard.name}, ${count} listings${yard.price_from > 0 ? `, from ${yard.price_from_display} a day` : ""}${yard.supplier.badge ? ", verified supplier" : ""}`}
      style={{ alignItems: "center", opacity: dimmed ? 0.4 : 1 }}
    >
      <View style={{ overflow: "hidden", ...plateFrame(selected) }}>
        <View style={{ flexDirection: "row", alignItems: "stretch", height: showDetail ? 28 : 24 }}>
          {showDetail ? (
            yard.supplier.logo ? (
              <Image source={{ uri: resolveMediaUrl(yard.supplier.logo) }} style={{ width: 28, height: 28 }} />
            ) : (
              <View style={{ justifyContent: "center", paddingHorizontal: 7 }}>
                <MonoText style={{ color: AMBER, fontSize: 13 }}>{initials}</MonoText>
              </View>
            )
          ) : (
            <View style={{ justifyContent: "center", paddingHorizontal: 6 }}>
              <MonoText style={{ color: PAPER, fontSize: 11 }}>
                {yard.price_from > 0 ? compactNaira(yard.price_from) : initials}
              </MonoText>
            </View>
          )}
          <View style={{ width: 1, backgroundColor: INK_RULE }} />
          <View style={{ justifyContent: "center", paddingHorizontal: showDetail ? 7 : 6 }}>
            <MonoText style={{ color: showDetail ? PAPER : tokens.color.colorInk300, fontSize: showDetail ? 13 : 11 }}>
              {count}
            </MonoText>
          </View>
          {showDetail && glyphClasses.length > 0 ? (
            <>
              <View style={{ width: 1, backgroundColor: INK_RULE }} />
              <View
                testID="yard-class-glyphs"
                accessibilityLabel={`Offers ${glyphClasses.map((c) => CLASS_BY_VALUE[c].label).join(", ")}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 }}
              >
                {glyphClasses.map((c) => {
                  const ClassGlyph = CLASS_GLYPHS[c];
                  return <ClassGlyph key={c} size={11} color={PAPER} />;
                })}
              </View>
            </>
          ) : null}
        </View>
        {showDetail && yard.price_from > 0 ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: INK_RULE,
              alignItems: "center",
              paddingVertical: 2,
              paddingHorizontal: 6,
            }}
          >
            <MonoText style={{ color: AMBER, fontSize: 10 }}>from {compactNaira(yard.price_from)}</MonoText>
          </View>
        ) : null}
      </View>
      {/* Verification seal — circular (a rounded square reads as a checkbox),
          detailed plate only: on every compact pin the map became a field of
          checks, and trust marks belong where identity is shown. */}
      {yard.supplier.badge && showDetail ? (
        <View
          testID="yard-verified-seal"
          style={{
            position: "absolute",
            right: -4,
            top: -4,
            width: 12,
            height: 12,
            borderRadius: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.color.colorBlue600,
          }}
        >
          <Svg width={8} height={8} viewBox="0 0 24 24">
            <Path d="M4 12l6 6 10 -12" stroke={PAPER} strokeWidth={3.5} fill="none" />
          </Svg>
        </View>
      ) : null}
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
