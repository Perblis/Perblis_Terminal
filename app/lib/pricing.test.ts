// Wave-8 mandatory: the pricing mirror reproduces fees.py's best-price
// vectors exactly (hire_value + scheme only — fee math is not ported, D-014).
import { inclusiveDays, quoteEstimate } from "./pricing";

// ₦ in kobo
const N = (naira: number) => naira * 100;

const LISTING = {
  daily_price: N(90_000),
  weekly_price: N(450_000),
  monthly_price: N(1_500_000),
};

test("inclusive duration (FSD §3.1): same day = 1", () => {
  expect(inclusiveDays("2026-07-10", "2026-07-10")).toBe(1);
  expect(inclusiveDays("2026-06-12", "2026-06-26")).toBe(15);
  expect(() => inclusiveDays("2026-07-10", "2026-07-09")).toThrow();
});

test("the 14-day case: 2 × weekly beats 14 × daily (D-008)", () => {
  const q = quoteEstimate(LISTING, "2026-07-10", "2026-07-23"); // 14 days
  expect(q).toMatchObject({ scheme: "weekly", units: 2, days: 14, totalKobo: N(900_000) });
  expect(q.totalDisplayEstimate).toBe("₦900,000");
  expect(q.durationLine).toBe("14 days → 2 × weekly — best price ✓");
});

test("tie resolves to the LONGER scheme", () => {
  // 7 days: daily 7×₦50k = ₦350k ties weekly 1×₦350k → weekly wins.
  const q = quoteEstimate(
    { daily_price: N(50_000), weekly_price: N(350_000), monthly_price: null },
    "2026-07-01",
    "2026-07-07",
  );
  expect(q.scheme).toBe("weekly");
  expect(q.totalKobo).toBe(N(350_000));
});

test("monthly wins long durations (ceil to 2 months at 31 days)", () => {
  const q = quoteEstimate(LISTING, "2026-07-01", "2026-07-31"); // 31 days
  // daily 31×90k=2,790k · weekly ceil(31/7)=5×450k=2,250k · monthly ceil(31/30)=2×1,500k=3,000k
  expect(q).toMatchObject({ scheme: "weekly", units: 5, totalKobo: N(2_250_000) });
  const q30 = quoteEstimate(LISTING, "2026-07-01", "2026-07-30"); // 30 days
  // daily 2,700k · weekly 5×450=2,250k · monthly 1×1,500k → monthly
  expect(q30).toMatchObject({ scheme: "monthly", units: 1, totalKobo: N(1_500_000) });
});

test("daily-only listings never claim best price", () => {
  const q = quoteEstimate(
    { daily_price: N(90_000), weekly_price: null, monthly_price: null },
    "2026-07-10",
    "2026-07-12",
  );
  expect(q.scheme).toBe("daily");
  expect(q.bestPrice).toBe(false);
  expect(q.durationLine).toBe("3 days → 3 × daily");
});

test("no priced scheme throws", () => {
  expect(() =>
    quoteEstimate({ daily_price: null as unknown as number, weekly_price: null, monthly_price: null }, "2026-07-01", "2026-07-02"),
  ).toThrow();
});
