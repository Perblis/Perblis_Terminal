// Listing titles are written by suppliers as "<asset> — <what it's for>", e.g.
// "Transit Concrete Mixer 8 m³ — ready-mix delivery". Rendered as one line in a
// row, that truncates to "Transit Concrete Mixer 8 m³ — ready-..." and the part
// a hirer scans for (the asset) shares its line with prose.
//
// Splitting it client-side gives every row a two-line hierarchy — name, then
// qualifier — with NO API change: the qualifier is already in the string, and
// the map payload's embedded summaries (MapYardListing) carry no `asset_type`
// to fall back on.

/** Separators suppliers actually use, longest first. Each is surrounded by
 *  whitespace so "8 m³-capacity" or "Low-bed" are never split. */
const SEPARATORS = [" — ", " – ", " -- ", " - "];

export type SplitTitle = {
  /** The asset itself — what the row leads with. */
  name: string;
  /** What it is for, sentence-cased. `null` when the title has no qualifier. */
  qualifier: string | null;
};

/**
 * Splits on the FIRST separator only, so
 * "Lowbed Trailer 60t — heavy plant moves — Lagos" keeps everything after the
 * first dash together rather than dropping it.
 */
export function splitListingTitle(title: string): SplitTitle {
  const raw = (title ?? "").trim();
  if (!raw) return { name: "", qualifier: null };

  let cut = -1;
  let width = 0;
  for (const sep of SEPARATORS) {
    const at = raw.indexOf(sep);
    if (at > 0 && (cut === -1 || at < cut)) {
      cut = at;
      width = sep.length;
    }
  }
  if (cut === -1) return { name: raw, qualifier: null };

  const name = raw.slice(0, cut).trim();
  const rest = raw.slice(cut + width).trim();
  if (!name || !rest) return { name: raw, qualifier: null };
  return { name, qualifier: sentenceCase(rest) };
}

/** "ready-mix delivery" → "Ready-mix delivery". Leaves an already-capitalised
 *  or non-alphabetic opener alone so "8x4 tipper work" and "ISO container
 *  storage" survive untouched. */
function sentenceCase(text: string): string {
  const first = text[0];
  if (!first || first !== first.toLowerCase()) return text;
  return first.toUpperCase() + text.slice(1);
}
