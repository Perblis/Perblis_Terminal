import { splitListingTitle } from "./listing-title";

test("splits the supplier's '<asset> — <purpose>' convention", () => {
  expect(splitListingTitle("Transit Concrete Mixer 8 m³ — ready-mix delivery")).toEqual({
    name: "Transit Concrete Mixer 8 m³",
    qualifier: "Ready-mix delivery",
  });
});

test("handles en dash and spaced hyphen as well as em dash", () => {
  expect(splitListingTitle("Boom Concrete Pump 38 m – slab and column pours").qualifier).toBe(
    "Slab and column pours",
  );
  expect(splitListingTitle("250 kVA Generator - event and site power").qualifier).toBe(
    "Event and site power",
  );
});

test("a title with no separator keeps its whole name and no qualifier", () => {
  expect(splitListingTitle("Electric Scissor Lift 12 m")).toEqual({
    name: "Electric Scissor Lift 12 m",
    qualifier: null,
  });
});

test("only the FIRST separator splits — later dashes stay in the qualifier", () => {
  expect(splitListingTitle("Lowbed Trailer 60t — heavy plant moves — Lagos only")).toEqual({
    name: "Lowbed Trailer 60t",
    qualifier: "Heavy plant moves — Lagos only",
  });
});

test("hyphens inside words never split the title", () => {
  // The separator must be whitespace-delimited or "Low-bed" and "8x4-capacity"
  // would lose their heads.
  expect(splitListingTitle("Low-bed Trailer 60t")).toEqual({
    name: "Low-bed Trailer 60t",
    qualifier: null,
  });
  expect(splitListingTitle("Towable Air Compressor 400 cfm — breaker-ready")).toEqual({
    name: "Towable Air Compressor 400 cfm",
    qualifier: "Breaker-ready",
  });
});

test("an already-capitalised or non-alphabetic qualifier is left alone", () => {
  expect(splitListingTitle("Reach Stacker 45t — ISO container handling").qualifier).toBe(
    "ISO container handling",
  );
  expect(splitListingTitle("Tipper Truck — 8x4 haulage").qualifier).toBe("8x4 haulage");
});

test("degenerate titles never lose text", () => {
  // A dangling separator must not produce an empty name or qualifier.
  expect(splitListingTitle("— orphaned")).toEqual({ name: "— orphaned", qualifier: null });
  // Trimmed first, so the trailing separator is no longer whitespace-delimited
  // and the title survives whole rather than splitting into an empty half.
  expect(splitListingTitle("Excavator — ")).toEqual({ name: "Excavator —", qualifier: null });
  expect(splitListingTitle("Excavator —  x")).toEqual({ name: "Excavator", qualifier: "X" });
  expect(splitListingTitle("   ")).toEqual({ name: "", qualifier: null });
  expect(splitListingTitle("")).toEqual({ name: "", qualifier: null });
});
