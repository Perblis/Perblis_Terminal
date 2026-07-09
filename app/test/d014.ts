// D-014 render-layer leak gate (wave-8 mandatory): hirers never see the fee.
// Every hire-touching screen renders with maximal fixtures that deliberately
// carry fee-bearing sibling values; this walker asserts none of them — nor
// any fee vocabulary — reach the rendered tree. Suites land with each screen
// slice (8C/8D); the walker and the forbidden set are the contract.
// Structural JSON-tree type (matches RTL's toJSON() output — no renderer import).
type JsonNode = {
  type: string;
  props?: Record<string, unknown>;
  children?: (JsonNode | string)[] | null;
};
type Node = JsonNode | (JsonNode | string)[] | string | null;

/** Recursively collect every rendered string (children + string props). */
export function collectStrings(node: Node): string[] {
  if (node === null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectStrings);
  const out: string[] = [];
  for (const value of Object.values(node.props ?? {})) {
    if (typeof value === "string") out.push(value);
  }
  out.push(...collectStrings((node.children as Node) ?? null));
  return out;
}

const FEE_VOCABULARY = /service[_ ]?fee|payout|commission|platform fee|fee[_ ]?basis/i;

/**
 * Fixture fee figures that must never render. Keep in sync with
 * test/fixtures — any formatted variant of these amounts is a leak.
 */
export const FORBIDDEN_AMOUNTS = ["135,000", "₦135,000", "13500000", "765,000", "₦765,000"];

export function expectNoFeeLeak(strings: string[]): void {
  const joined = strings.join(" ␟ ");
  expect(joined).not.toMatch(FEE_VOCABULARY);
  for (const amount of FORBIDDEN_AMOUNTS) {
    expect(joined).not.toContain(amount);
  }
}
