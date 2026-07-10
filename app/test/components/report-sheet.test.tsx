// F10 report sheet — submit posts the reason and shows a thank-you with NO
// reporter-side status (anti-gaming).
import { fireEvent } from "@testing-library/react-native";

import { ReportSheet } from "../../components/listing/report-sheet";
import { renderScreen } from "../render";

let posted: unknown = null;

beforeEach(() => {
  posted = null;
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/reports") && init?.method === "POST") {
      posted = JSON.parse(String(init?.body));
      return { ok: true, status: 201, json: async () => ({ id: "r1" }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("select reason → submit posts it → thank-you, no status shown", async () => {
  const screen = await renderScreen(<ReportSheet listingId="l1" visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByText("Fraudulent or a scam"));
  await fireEvent.press(screen.getByText("Submit report"));
  expect(await screen.findByText(/we.ll take a look/i)).toBeTruthy();
  expect(posted).toEqual({ reason: "fraudulent" });
  // No status / tracking is offered to the reporter.
  expect(screen.queryByText(/pending|under review|status/i)).toBeNull();
});
