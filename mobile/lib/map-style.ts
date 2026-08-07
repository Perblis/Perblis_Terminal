// Terminal Chart style (D-022): Liberty base fetched at runtime with the
// packages/tokens/map grade applied per theme. When the committed
// terminal-chart-{theme}.json snapshots land (network-gated founder/CI
// step), this module can require() them instead — same shape.
import grade from "@terminal/tokens/map/grade.json";

type GradeRule = {
  match: { type?: string; idIncludes?: string[] };
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

type StyleLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

export type MapTheme = "light" | "dark";

export const LIBERTY_URL: string = grade.styleUrl;

function matches(layer: StyleLayer, match: GradeRule["match"]): boolean {
  if (match.type && layer.type !== match.type) return false;
  if (match.idIncludes && !match.idIncludes.some((s) => layer.id.includes(s))) return false;
  return true;
}

/** Pure: applies the theme's rules to a style document (first match wins). */
export function applyGrade(style: { layers?: StyleLayer[] }, theme: MapTheme) {
  const rules = grade.themes[theme].rules as GradeRule[];
  const graded = { ...style, layers: (style.layers ?? []).map((l) => ({ ...l })) };
  for (const layer of graded.layers) {
    for (const rule of rules) {
      if (!matches(layer, rule.match)) continue;
      if (rule.paint) layer.paint = { ...layer.paint, ...rule.paint };
      if (rule.layout) layer.layout = { ...layer.layout, ...rule.layout };
      break;
    }
  }
  return graded;
}

export type TerminalChartStyle = string | { layers?: StyleLayer[] };

const cache = new Map<MapTheme, TerminalChartStyle>();

/**
 * Resolves the style document for MapLibre. Falls back to the ungraded
 * Liberty URL if the fetch fails (tiles still render; grade is cosmetic).
 */
export async function getTerminalChartStyle(theme: MapTheme): Promise<TerminalChartStyle> {
  const cached = cache.get(theme);
  if (cached) return cached;
  try {
    const resp = await fetch(LIBERTY_URL);
    if (!resp.ok) throw new Error(String(resp.status));
    const base = (await resp.json()) as { layers?: StyleLayer[] };
    const graded = applyGrade(base, theme);
    cache.set(theme, graded);
    return graded;
  } catch {
    return LIBERTY_URL;
  }
}
