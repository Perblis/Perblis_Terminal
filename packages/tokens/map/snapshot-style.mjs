// Bakes grade.json into full committed Terminal Chart style JSONs.
// Requires network access to tiles.openfreemap.org (proxy-blocked in the
// agent build env — run this from a founder machine or CI):
//
//   node packages/tokens/map/snapshot-style.mjs
//
// Emits terminal-chart-light.json + terminal-chart-dark.json next to this
// file. Commit them; consumers can then use the frozen JSONs instead of
// runtime-fetching Liberty + applying grade.json.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const grade = JSON.parse(readFileSync(join(DIR, "grade.json"), "utf8"));

function matches(layer, match) {
  if (match.type && layer.type !== match.type) return false;
  if (match.idIncludes && !match.idIncludes.some((s) => layer.id.includes(s))) return false;
  return true;
}

export function applyGrade(style, rules) {
  const graded = structuredClone(style);
  for (const layer of graded.layers ?? []) {
    for (const rule of rules) {
      if (!matches(layer, rule.match)) continue;
      if (rule.paint) layer.paint = { ...layer.paint, ...rule.paint };
      if (rule.layout) layer.layout = { ...layer.layout, ...rule.layout };
      break; // first matching rule wins
    }
  }
  return graded;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const resp = await fetch(grade.styleUrl);
  if (!resp.ok) throw new Error(`Failed to fetch Liberty style: ${resp.status}`);
  const base = await resp.json();
  for (const [theme, def] of Object.entries(grade.themes)) {
    const out = applyGrade(base, def.rules);
    out.name = `Terminal Chart (${theme})`;
    writeFileSync(join(DIR, `terminal-chart-${theme}.json`), JSON.stringify(out, null, 2));
    console.log(`Wrote terminal-chart-${theme}.json (${out.layers.length} layers)`);
  }
}
