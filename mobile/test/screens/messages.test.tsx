// S14 Messages list — filter partition, unread rendering, row navigation.
import { fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";

import MessagesTab from "../../app/(tabs)/messages";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

function conv(id: string, kind: "enquiry" | "hire", extra: Record<string, unknown> = {}) {
  return {
    id,
    kind,
    hire_id: kind === "hire" ? `hire-${id}` : null,
    counterparty: { id: `s-${id}`, name: `Supplier ${id}`, verified: true },
    listing: kind === "enquiry" ? { id: `l-${id}`, title: `Listing ${id}`, thumb_url: null } : null,
    yard_name: null,
    last_message_preview: `Message in ${id}`,
    last_message_at: "2026-08-07T12:00:00Z",
    unread_count: id === "c1" ? 3 : 0,
    ...extra,
  };
}

const CONVERSATIONS = [conv("c1", "enquiry"), conv("c2", "hire")];

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/conversations")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ next: null, results: CONVERSATIONS, unread_total: 3 }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("lists conversations with unread and navigates to a thread", async () => {
  const screen = await renderScreen(<MessagesTab />);
  expect(await screen.findByText("Supplier c1")).toBeTruthy();
  expect(screen.getByText("3")).toBeTruthy(); // unread pill
  await fireEvent.press(screen.getByText("Supplier c1"));
  expect(router.push).toHaveBeenCalledWith("/messages/c1");
});

test("Hires filter shows only hire conversations", async () => {
  const screen = await renderScreen(<MessagesTab />);
  await screen.findByText("Supplier c1");
  await fireEvent.press(screen.getByText("Hires"));
  expect(await screen.findByText("Supplier c2")).toBeTruthy();
  expect(screen.queryByText("Supplier c1")).toBeNull(); // enquiry filtered out
});
