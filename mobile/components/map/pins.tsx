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
// marketplace convention (Airbnb/Zillow price pills).
//
// Discovery-layer revision (founder, 2026-08-08): "the selected marker
// duplicates information shown in the bottom card." It did, literally: the
// detailed yard plate (logo/initials │ count │ ≤3 class glyphs, over a
// `from ₦68k` row, plus the verification seal) only ever rendered on the
// SELECTED pin — i.e. exactly when the bottom sheet below it was already
// showing the same company, the same count and the same price. So the
// detailed plate is gone. ONE anatomy now, selected or not:
//
//     ₦68k │ 5          price primary (paper), count secondary (ink-300)
//
// Selection is expressed by the frame alone — brand border + elevation, same
// size, same layout, so a selected pin never grows or re-anchors under the
// finger. Identity (logo, company name, verification tick) belongs to the
// sheet, which is the only place it is now drawn. Everything the plate stopped
// drawing survives verbatim in the accessibility label.
//
// Brand correction (D-028): selection/emphasis is `primary.500` acid lime, the
// brand. `amber.500` became the WARNING hue when the palette was ported from
// Infisical — these plates had been painting the map's most important state in
// the warning colour ever since.
import { View } from "react-native";
import { tokens } from "@terminal/tokens";

import { CLASS_BY_VALUE } from "../../lib/asset-classes";
import { assetNoun, countNoun } from "../../lib/asset-noun";
import { compactNaira } from "../../lib/naira";
import { useThemeTokens } from "../../lib/theme";
import { CLASS_GLYPHS } from "../brand/class-glyphs";
import type { MapYard, MapSoloListing } from "../../lib/types";
import { MonoText, BodyText } from "../ui/text";

const INK = tokens.color.colorInk900;
const INK_RULE = tokens.color.colorInk700;
const PLATE_BORDER = tokens.color.colorInk400;
/** Brand = acid lime (D-028). NOT amber — amber is the warning hue. */
const BRAND = tokens.color.colorPrimary500;
const PAPER = tokens.color.colorPaper0;
const COUNT = tokens.color.colorInk300;

/** Shared plate frame: ink field, hairline border, brand + lift when selected. */
function plateFrame(selected: boolean) {
  return {
    backgroundColor: INK,
    borderRadius: 4,
    borderWidth: selected ? 2 : 1,
    borderColor: selected ? BRAND : PLATE_BORDER,
    // e-1 (08 §elevation) — overlay lift, the only thing that changes on select
    // besides the border. No scale, so the plate never jumps under the finger.
    ...(selected
      ? { shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }
      : null),
  } as const;
}

/**
 * Solo asset plate: ink tag with the class-coloured edge strip and the compact
 * from-price. The class glyph rides along only on the selected plate — on the
 * 20-odd unselected pins in a viewport it was decoration competing with the one
 * datum that decides a tap. On-hire listings dim to 45% (like zero-match yards
 * — informative, never removed). The class hue stays an index mark, not the
 * body of the pin (D-023).
 */
export function AssetPin({
  listing,
  selected = false,
}: {
  listing: MapSoloListing;
  selected?: boolean;
}) {
  const t = useThemeTokens();
  const meta = CLASS_BY_VALUE[listing.asset_class];
  const strip = t[meta.varKey];
  const Glyph = CLASS_GLYPHS[listing.asset_class];
  return (
    <View
      accessibilityLabel={`${meta.label} listing: ${listing.title}, from ${listing.price_from_display} a day${listing.available ? "" : ", currently on hire"}`}
      style={{
        height: selected ? 28 : 24,
        flexDirection: "row",
        alignItems: "stretch",
        overflow: "hidden",
        opacity: listing.available ? 1 : 0.45,
        ...plateFrame(selected),
      }}
    >
      <View style={{ width: 3, backgroundColor: strip }} />
      {selected ? (
        <View style={{ justifyContent: "center", paddingLeft: 5 }}>
          <Glyph size={13} color={PAPER} />
        </View>
      ) : null}
      {listing.price_from > 0 ? (
        <View style={{ justifyContent: "center", paddingHorizontal: selected ? 5 : 6 }}>
          <MonoText style={{ color: PAPER, fontSize: selected ? 12 : 11 }}>
            {compactNaira(listing.price_from)}
          </MonoText>
        </View>
      ) : (
        <View style={{ width: 6, justifyContent: "center", paddingRight: 6 }}>
          {selected ? null : <Glyph size={11} color={PAPER} />}
        </View>
      )}
    </View>
  );
}

/**
 * Yard plate — one anatomy, always: `₦68k │ 5`. Price leads in paper mono
 * (the datum that decides a tap), the count follows in ink-300 (how much is
 * here), separated by a hairline rule. `matching_count` when filtered, so a
 * class filter changes the number on the pin. Initials stand in only when the
 * yard has no price at all.
 *
 * matching_count 0 ⇒ whole plate at 40%, never removed (FSD §6). Identity —
 * logo, company name, verification — is the sheet's job, not the pin's.
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
  const dimmed = filtered && yard.matching_count === 0;
  const count = filtered ? yard.matching_count : yard.listing_count;
  const initials = yard.supplier.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View
      accessibilityLabel={`Yard: ${yard.name}, ${countNoun(count, assetNoun(yard.class_mix))}${yard.price_from > 0 ? `, from ${yard.price_from_display} a day` : ""}${yard.supplier.badge ? ", verified supplier" : ""}`}
      style={{ alignItems: "center", opacity: dimmed ? 0.4 : 1 }}
    >
      <View style={{ overflow: "hidden", ...plateFrame(selected) }}>
        <View style={{ flexDirection: "row", alignItems: "stretch", height: selected ? 28 : 24 }}>
          <View style={{ justifyContent: "center", paddingHorizontal: 6 }}>
            <MonoText style={{ color: PAPER, fontSize: selected ? 12 : 11 }}>
              {yard.price_from > 0 ? compactNaira(yard.price_from) : initials}
            </MonoText>
          </View>
          <View style={{ width: 1, backgroundColor: INK_RULE }} />
          <View style={{ justifyContent: "center", paddingHorizontal: 6 }}>
            <MonoText style={{ color: COUNT, fontSize: selected ? 12 : 11 }}>{count}</MonoText>
          </View>
        </View>
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
