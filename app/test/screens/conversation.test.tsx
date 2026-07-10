// S15 mandatory: first-occurrence masked explainer, mine/theirs bubbles,
// optimistic send + per-message retry, and mark-read posting {conversation_id}.
import { fireEvent, waitFor } from "@testing-library/react-native";

import Conversation from "../../app/messages/[id]";
import { useSession } from "../../stores/session";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "c1" }),
}));

const CONV = {
  id: "c1",
  kind: "enquiry",
  hire_id: null,
  unlocked: false,
  counterparty: { id: "sup1", name: "Dangote Plant Co", verified: true },
  listing: { id: "l1", title: "CAT 320D", thumb_url: null },
  yard_name: "Apapa Yard",
  last_message_preview: "call me",
  last_message_at: "2026-08-07T12:00:00Z",
  unread_count: 1,
};

const MESSAGES = [
  { id: "m1", conversation_id: "c1", sender_id: "sup1", body: "Call me on 0803•••", masked: true, sent_at: "2026-08-07T10:00:00Z", read_at: null },
  { id: "m2", conversation_id: "c1", sender_id: "me1", body: "Is it available?", masked: false, sent_at: "2026-08-07T11:00:00Z", read_at: null },
];

let sendShouldFail = false;
let readBodies: unknown[] = [];

beforeEach(() => {
  sendShouldFail = false;
  readBodies = [];
  useSession.setState({
    me: { id: "me1", full_name: "Me", email: "m@e.com", phone: "0800", is_supplier: false, is_hirer: true, account_level: "basic", is_phone_verified: true, is_email_verified: true, is_verified: false },
  });
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/realtime/token")) {
      return { ok: true, status: 200, json: async () => ({ status: "not_configured" }) } as unknown as Response;
    }
    if (u.includes("/messages/read")) {
      readBodies.push(JSON.parse(String(init?.body)));
      return { ok: true, status: 200, json: async () => ({ marked_read: 1 }) } as unknown as Response;
    }
    if (u.match(/\/conversations\/c1\/messages$/) && init?.method === "POST") {
      if (sendShouldFail) return { ok: false, status: 500, json: async () => ({ error: { code: "x", message: "boom" } }) } as unknown as Response;
      return { ok: true, status: 201, json: async () => ({ id: "m3" }) } as unknown as Response;
    }
    if (u.includes("/conversations/c1/messages")) {
      return { ok: true, status: 200, json: async () => ({ next: null, results: MESSAGES }) } as unknown as Response;
    }
    if (u.includes("/conversations")) {
      return { ok: true, status: 200, json: async () => ({ next: null, results: [CONV], unread_total: 1 }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("first-occurrence masked explainer + both bubbles; marks read with conversation_id", async () => {
  const screen = await renderScreen(<Conversation />);
  expect(await screen.findByText("Is it available?")).toBeTruthy(); // mine
  expect(screen.getByText("Call me on 0803•••")).toBeTruthy(); // theirs (masked)
  expect(screen.getByText(/Numbers unlock after payment/)).toBeTruthy(); // first-occurrence banner
  expect(screen.getByText("contact hidden until paid")).toBeTruthy(); // masked pill
  await waitFor(() => expect(readBodies.length).toBeGreaterThan(0));
  expect(readBodies[0]).toEqual({ conversation_id: "c1" }); // backend contract, not message_ids
});

test("optimistic send fails then retries to success", async () => {
  sendShouldFail = true;
  const screen = await renderScreen(<Conversation />);
  await screen.findByText("Is it available?");
  await fireEvent.changeText(screen.getByLabelText("Message"), "Hello there");
  await fireEvent.press(screen.getByText("Send"));
  expect(await screen.findByText("Hello there")).toBeTruthy(); // optimistic bubble
  expect(await screen.findByText(/didn.t send\. Retry/)).toBeTruthy();
  sendShouldFail = false;
  await fireEvent.press(screen.getByText(/didn.t send\. Retry/));
  await waitFor(() => expect(screen.queryByText(/didn.t send\. Retry/)).toBeNull()); // cleared on success
});
