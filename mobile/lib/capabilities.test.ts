import { capabilities, capabilityLine, coreSpecLine, groupThousands, sharedCapabilities } from "./capabilities";
import type { StorefrontListing } from "./types";

// The three real Greenfield Cold Chain rows from backend/core/seed/market_data.py,
// verbatim. If the seed changes, these tests should be updated from it — they
// are the contract between the curated tables and the data that exists.
const FROZEN_SPECS = {
  security: ["Fenced", "CCTV", "Access control", "Guards 24-7"],
  floor_area: 800,
  power_supply: "Three-phase",
  truck_access: "Trailer-accessible",
  ceiling_height: 7,
  temperature_range: "Frozen −18°C",
  temperature_monitoring: true,
  cold_capacity: 800,
  backup_power: true,
  loading_bays: 3,
  dock_levellers: true,
  fire_safety: ["Extinguishers", "Alarms"],
};

const CHILLED_SPECS = {
  security: ["Fenced", "CCTV", "Access control"],
  floor_area: 500,
  power_supply: "Three-phase",
  truck_access: "Trailer-accessible",
  ceiling_height: 6,
  temperature_range: "Chilled 0–8°C",
  temperature_monitoring: true,
  cold_capacity: 500,
  backup_power: true,
  loading_bays: 2,
};

const AMBIENT_SPECS = {
  security: ["Fenced", "CCTV", "Guards 24-7"],
  floor_area: 1200,
  power_supply: "Three-phase",
  truck_access: "Trailer-accessible",
  ceiling_height: 8,
  backup_power: true,
  loading_bays: 2,
  racking_installed: true,
  pallet_positions: 900,
  fire_safety: ["Extinguishers", "Hydrants"],
};

function storefrontListing(over: Partial<StorefrontListing> = {}): StorefrontListing {
  return {
    id: "0199a000-0000-7000-8000-000000000001",
    title: "Frozen Store −18°C — 800 sqm, 24/7 monitoring",
    asset_class: "warehousing",
    asset_type: "Cold Storage",
    daily_price_display: "₦340,000",
    cover_photo_url: "cold.jpg",
    yard_id: "yard-1",
    ...over,
  };
}

test("groups thousands without relying on Intl", () => {
  // Hermes' Intl support is not guaranteed, so the grouping is hand-rolled.
  expect(groupThousands(1200)).toBe("1,200");
  expect(groupThousands(900)).toBe("900");
  expect(groupThousands(20000)).toBe("20,000");
  expect(groupThousands(4.5)).toBe("4.5");
});

test("the Frozen Store's capabilities read in priority order", () => {
  expect(capabilities("warehousing", FROZEN_SPECS, 3)).toEqual([
    "Temperature monitoring",
    "Backup power",
    "Dock levellers",
  ]);
});

test("absence is never rendered as negation", () => {
  // The Chilled Store has NO dock_levellers key — nobody filled it in. It must
  // not appear at all, and it must never appear as "No".
  const line = capabilities("warehousing", CHILLED_SPECS).join(" · ");
  expect(line).not.toContain("Dock levellers");
  expect(line).not.toContain("No");
  expect(capabilities("warehousing", CHILLED_SPECS, 3)).toEqual([
    "Temperature monitoring",
    "Backup power",
    "2 loading bays",
  ]);
});

test("false is suppressed exactly like a missing key", () => {
  const withFalse = capabilities("warehousing", { ...CHILLED_SPECS, dock_levellers: false });
  const without = capabilities("warehousing", CHILLED_SPECS);
  expect(withFalse).toEqual(without);
});

test("multi values follow the allowlist order, not the supplier's array order", () => {
  // Frozen lists security as [Fenced, CCTV, Access control, Guards 24-7]; the
  // strongest signal (24-7 guards) must lead regardless of input position.
  const all = capabilities("warehousing", FROZEN_SPECS);
  expect(all).toContain("24-7 guards");
  expect(all.indexOf("24-7 guards")).toBeLessThan(all.indexOf("CCTV"));
  // Capped at 2 per field: "Access control" and "Fenced" do not also appear.
  expect(all).not.toContain("Access control");
  expect(all).not.toContain("Fenced");
});

test("values that mean nothing are suppressed", () => {
  expect(capabilities("warehousing", { power_supply: "None" })).toEqual([]);
  expect(capabilities("terminals_yards", { customs_status: "Non-bonded" })).toEqual([]);
  expect(capabilities("terminals_yards", { handling_equipment: ["None — hirer brings own"] })).toEqual([]);
  expect(capabilities("land_staging", { fencing: "Open" })).toEqual([]);
  expect(capabilities("trucks_haulage", { insurance_cover: "None disclosed" })).toEqual([]);
  expect(capabilities("plant_machinery", { operator_included: "Not available" })).toEqual([]);
});

test("counts are suppressed at zero and read with their noun", () => {
  expect(capabilities("warehousing", { loading_bays: 0 })).toEqual([]);
  expect(capabilities("warehousing", { loading_bays: 3 })).toEqual(["3 loading bays"]);
  expect(capabilities("terminals_yards", { reefer_plugs: 40 })).toEqual(["40 reefer plugs"]);
});

test("a core figure is never repeated as a capability", () => {
  // pallet_positions is the Dry Warehouse's core figure, so the card shows it
  // once on the specification line — not again among the capabilities.
  expect(capabilities("warehousing", { pallet_positions: 900 })).toEqual([]);
  const core = coreSpecLine(
    storefrontListing({ title: "Ambient Warehouse — beside the cold hub", asset_type: "Dry Warehouse" }),
    AMBIENT_SPECS,
  );
  expect(core.spec).toBe("1,200 sqm · 900 pallet spaces");
});

test("fitted infrastructure outranks access details", () => {
  // Racking is the reason a hirer picks one dry store over another; a loading
  // bay count is not.
  expect(capabilities("warehousing", AMBIENT_SPECS, 3)).toEqual([
    "Backup power",
    "Racking installed",
    "2 loading bays",
  ]);
});

test("free text is never rendered", () => {
  // certifications / condition_notes are unbounded supplier prose.
  const line = capabilities("plant_machinery", {
    certifications: "NAFDAC pending, HACCP audited 2025",
    condition_notes: "Repainted last month",
    condition: "Excellent",
  });
  expect(line).toEqual(["Excellent condition"]);
});

test("an unknown spec key is ignored rather than thrown at", () => {
  expect(() => capabilities("warehousing", { some_future_field: true, backup_power: true })).not.toThrow();
  expect(capabilities("warehousing", { some_future_field: true, backup_power: true })).toEqual([
    "Backup power",
  ]);
});

test("no specs at all yields no capabilities", () => {
  expect(capabilities("warehousing", undefined)).toEqual([]);
});

test("every class produces something from a full spec sheet", () => {
  // land_staging and trucks_haulage are the two the original brief omitted.
  const fixtures: [Parameters<typeof capabilities>[0], Record<string, unknown>][] = [
    ["warehousing", FROZEN_SPECS],
    ["terminals_yards", { weighbridge: true, handling_equipment: ["Reach stacker"], rail_access: true }],
    ["land_staging", { fencing: "Fully fenced", utilities: ["Power", "Water"], gradient: "Level" }],
    ["plant_machinery", { operator_included: "Included", condition: "Good", ripper: true }],
    ["trucks_haulage", { driver_included: "Included", tail_lift: true, operating_range: "Nationwide" }],
  ];
  for (const [cls, specs] of fixtures) {
    const found = capabilities(cls, specs, 3);
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThanOrEqual(3);
  }
});

test("every phrase stays within three words", () => {
  // A guard against copy drift: a card line has room for three items, so no
  // single phrase may sprawl. Runs over every class's whole table.
  const sheets: [Parameters<typeof capabilities>[0], Record<string, unknown>][] = [
    ["warehousing", { ...FROZEN_SPECS, ...AMBIENT_SPECS, office_space: true, cross_dock: true, climate_controlled: true, access_hours: "24-7", customs_licence_status: "Active" }],
    [
      "terminals_yards",
      {
        weighbridge: true,
        handling_equipment: ["Reach stacker", "Empty handler", "Crane", "Forklift"],
        reefer_plugs: 40,
        operating_hours: "24-7",
        rail_access: true,
        berth_access: true,
        customs_examination_area: true,
        gate_system: "Gate + tally",
        surface_type: "Interlocked",
      },
    ],
    [
      "land_staging",
      {
        fencing: "Fully fenced",
        access_road: "Trailer-accessible",
        utilities: ["Power", "Water", "Drainage"],
        gantry_crane: true,
        covered_area: 600,
        security: ["Guards"],
        gradient: "Level",
        surface_type: "Tarmac",
      },
    ],
    [
      "plant_machinery",
      { operator_included: "Available (extra)", condition: "Excellent", fuel_type: "Electric", ripper: true, vibratory: true, soundproof: true, engine_power: 180 },
    ],
    [
      "trucks_haulage",
      { driver_included: "Available (extra)", insurance_cover: "Goods-in-transit", tail_lift: true, ramps: true, pump: true, operating_range: "Regional" },
    ],
  ];
  for (const [cls, specs] of sheets) {
    for (const phrase of capabilities(cls, specs)) {
      expect(phrase.split(" ").length).toBeLessThanOrEqual(3);
    }
  }
});

test("shared capabilities are what every facility asserts", () => {
  const shared = sharedCapabilities([
    { asset_class: "warehousing", specs: FROZEN_SPECS },
    { asset_class: "warehousing", specs: CHILLED_SPECS },
    { asset_class: "warehousing", specs: AMBIENT_SPECS },
  ]);
  expect(shared).toContain("Backup power");
  expect(shared).toContain("Three-phase power");
  expect(shared).toContain("Trailer access");
  // Ambient has no temperature monitoring, so it is not shared.
  expect(shared).not.toContain("Temperature monitoring");
  // Only Frozen has dock levellers.
  expect(shared).not.toContain("Dock levellers");
});

test("shared capabilities need at least two facilities, and every one resolved", () => {
  expect(sharedCapabilities([{ asset_class: "warehousing", specs: FROZEN_SPECS }])).toEqual([]);
  // One unresolved listing means the intersection is unknown, not empty-ish.
  expect(
    sharedCapabilities([
      { asset_class: "warehousing", specs: FROZEN_SPECS },
      { asset_class: "warehousing", specs: undefined },
    ]),
  ).toEqual([]);
});

test("the core line leads with the spec a hirer chooses on", () => {
  const core = coreSpecLine(
    storefrontListing({ title: "Ambient Warehouse 1,200 sqm — beside the cold hub", asset_type: "Dry Warehouse" }),
    AMBIENT_SPECS,
  );
  expect(core.figure).toBe(true);
  expect(core.spec).toContain("900 pallet spaces");
});

test("the core line never repeats a figure the title already shows", () => {
  // Title is "Frozen Store −18°C — 800 sqm…", so the name carries −18°C and
  // the core line must not say it twice.
  const core = coreSpecLine(storefrontListing(), FROZEN_SPECS);
  expect(core.name).toBe("Frozen Store −18°C");
  expect(core.spec).toBe("800 sqm");
});

test("without specs the core line falls back to the shipped title derivation", () => {
  const core = coreSpecLine(storefrontListing(), undefined);
  expect(core).toEqual({ name: "Frozen Store −18°C", spec: "800 sqm", figure: true });
});

test("the capability row is never empty, so a card's height never changes", () => {
  // Resolved: real capabilities.
  expect(capabilityLine(storefrontListing(), FROZEN_SPECS)).toBe(
    "Temperature monitoring · Backup power · Dock levellers",
  );
  // Unresolved (past the cap, 404, offline): still says something true.
  expect(capabilityLine(storefrontListing(), undefined)).toBe("Cold Storage");
  expect(capabilityLine(storefrontListing(), undefined).length).toBeGreaterThan(0);
});
