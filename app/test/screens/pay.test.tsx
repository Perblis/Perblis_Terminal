// Wave-8 mandatory: S8 payment-state coverage (success/failure/expiry) ×
// the D-014 leak walker — the hire fixture deliberately carries fee-bearing
// sibling values that must never render, receipt included.
import Pay from "../../app/pay/[hireId]";
import { collectStrings, expectNoFeeLeak } from "../d014";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ hireId: "h1" }),
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({})) }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn(async () => "file://x.png") }));
jest.mock("react-native-qrcode-svg", () => {
  const { View } = jest.requireActual("react-native");
  return function QRCode() {
    return <View testID="qr" />;
  };
});

const BASE_HIRE = {
  id: "h1-abcdef00",
  listing_id: "l1",
  listing_title: "CAT 320D — 20t Excavator",
  asset_class: "plant_machinery",
  yard_id: "y1",
  listing_photo: "",
  start_date: "2026-08-10",
  end_date: "2026-08-23",
  duration_days: 14,
  scheme: "weekly",
  status: "accepted",
  hire_value: 90000000,
  hire_value_display: "₦900,000",
  cancelled_by: null as string | null,
  decline_reason: "",
  cancel_reason: "",
  hirer_note: "",
  request_expires_at: "2026-08-08T12:00:00Z",
  payment_deadline: new Date(Date.now() + 3 * 3600_000).toISOString(),
  created_at: "2026-08-07T12:00:00Z",
  events: [],
  // fee-bearing siblings — must NEVER render:
  service_fee: 13500000,
  service_fee_display: "₦135,000",
  payout_amount: 76500000,
  payout_amount_display: "₦765,000",
};

const PAYMENT = {
  reference: "ref-1",
  state: "initiated",
  authorization_url: "https://checkout.paystack.com/x",
  attempt: 1,
  paid_at: null,
};

function mockApi(hire: typeof BASE_HIRE, payment = PAYMENT) {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    const body = u.endsWith("/payment") ? payment : hire;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

test("accepted: countdown + vault LockedTerms + Pay now; no fee leak", async () => {
  mockApi(BASE_HIRE);
  const screen = await renderScreen(<Pay />);
  expect(await screen.findByText("You pay")).toBeTruthy();
  expect(screen.getByText("₦900,000")).toBeTruthy();
  expect(screen.getByText("Terms locked at acceptance")).toBeTruthy();
  expect(screen.getByText("left to pay")).toBeTruthy();
  // The button label depends on the SEPARATE payment-status query clearing its
  // busy spinner — await it rather than reading it synchronously off the hire.
  expect(await screen.findByText("Pay now")).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("failure: mapped copy + attempts left; countdown persists; no fee leak", async () => {
  mockApi(BASE_HIRE, { ...PAYMENT, state: "failed", attempt: 2 });
  const screen = await renderScreen(<Pay />);
  expect(await screen.findByText("That payment didn’t go through.")).toBeTruthy();
  expect(screen.getByText(/1 attempt left/)).toBeTruthy();
  expect(screen.getByText("Try again")).toBeTruthy();
  expect(screen.getByText("left to pay")).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("expiry (system-cancelled): dates-released copy + re-request; no fee leak", async () => {
  mockApi({ ...BASE_HIRE, status: "cancelled", cancelled_by: "system" });
  const screen = await renderScreen(<Pay />);
  expect(await screen.findByText("The payment window closed")).toBeTruthy();
  expect(screen.getByText("Request again")).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});

test("confirmed: stamp + receipt artefact with ONLY the hirer total", async () => {
  mockApi({ ...BASE_HIRE, status: "confirmed" });
  const screen = await renderScreen(<Pay />);
  expect(await screen.findByText("You’re confirmed")).toBeTruthy();
  expect(screen.getAllByText("PAID").length).toBeGreaterThan(0);
  expect(screen.getAllByText("₦900,000").length).toBeGreaterThan(0); // hero + receipt
  expect(screen.getByText("Share receipt")).toBeTruthy();
  expectNoFeeLeak(collectStrings(screen.toJSON() as never));
});
