// Copied from portal/lib/naira.ts (Wave 7) — keep in sync by copy, not import;
// the portal stays untouched by app changes (design.md §7 wave isolation).
// Naira input helpers. UI speaks whole naira; the API speaks integer kobo
// (design.md §2). Conversion happens ONLY here, at the form edge.

/** "250,000" | "250000" → 25_000_000 kobo; null when not a positive amount. */
export function parseNairaInput(raw: string): number | null {
  const digits = raw.replace(/[,\s₦]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const naira = Number(digits);
  if (!Number.isSafeInteger(naira * 100) || naira <= 0) return null;
  return naira * 100;
}

/** 25_000_000 kobo → "250,000" for input display. */
export function formatNairaInput(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "";
  return Math.floor(kobo / 100).toLocaleString("en-NG");
}

/** Pin/chip-scale money: 25_000_000 kobo → "₦250k"; 180_000_000 → "₦1.8m".
 *  Glance-legible on a map plate; full display strings render everywhere else. */
export function compactNaira(kobo: number): string {
  const naira = Math.floor(kobo / 100);
  if (naira >= 1_000_000) {
    const m = naira / 1_000_000;
    const rounded = m >= 10 ? Math.round(m) : Math.round(m * 10) / 10;
    return `₦${rounded}m`;
  }
  if (naira >= 1_000) return `₦${Math.round(naira / 1_000)}k`;
  return `₦${naira}`;
}
