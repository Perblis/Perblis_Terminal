// D-016: the offline handover queue is the one allowed offline mutation.
// Enqueue survives offline; the drainer uploads + submits on reconnect.
import { onlineManager } from "@tanstack/react-query";

import { drainHandoverQueue, useHandoverQueue } from "./handover-queue";

const PRESIGN = {
  key: "handovers/uploaded.jpg",
  bucket: "public",
  presigned_put_url: "https://r2.example/put",
  expires_in: 900,
};

const RECORD = {
  id: "ho1",
  hire: "h1",
  kind: "on_hire",
  photos: ["handovers/uploaded.jpg"],
  reading: {},
  submitted_by_role: "hirer",
  confirmed_at: null,
  created_at: "2026-08-01T00:00:00Z",
};

let postCount = 0;

beforeEach(() => {
  useHandoverQueue.setState({ items: [] });
  onlineManager.setOnline(true);
  postCount = 0;
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/media/presign")) {
      return { ok: true, status: 200, json: async () => PRESIGN } as unknown as Response;
    }
    if (u.includes("/handovers") && init?.method === "POST") {
      postCount += 1;
      return { ok: true, status: 201, json: async () => RECORD } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

const item = {
  hireId: "h1",
  kind: "on_hire" as const,
  photos: [
    { uri: "file:///a.jpg", width: 4000, height: 3000 },
    { uri: "file:///b.jpg", width: 4000, height: 3000 },
  ],
  reading: { hour_meter: 1200 },
};

test("enqueue stores a queued item that survives (persisted, resume-safe)", () => {
  const id = useHandoverQueue.getState().enqueue(item);
  const stored = useHandoverQueue.getState().items;
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe(id);
  expect(stored[0].status).toBe("queued");
  expect(stored[0].photos).toHaveLength(2);
});

test("drain uploads + submits when online, then removes the item", async () => {
  useHandoverQueue.getState().enqueue(item);
  const submitted = await drainHandoverQueue();
  expect(submitted).toEqual(["h1"]);
  expect(postCount).toBe(1); // one record submitted
  expect(useHandoverQueue.getState().items).toHaveLength(0); // removed on success
});

test("drain is a no-op offline — the capture stays queued", async () => {
  useHandoverQueue.getState().enqueue(item);
  onlineManager.setOnline(false);
  const submitted = await drainHandoverQueue();
  expect(submitted).toEqual([]);
  expect(postCount).toBe(0);
  expect(useHandoverQueue.getState().items[0].status).toBe("queued");
  onlineManager.setOnline(true);
});

test("a failed submit marks the item failed and keeps it for retry", async () => {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/media/presign")) {
      return { ok: true, status: 200, json: async () => PRESIGN } as unknown as Response;
    }
    if (u.includes("/handovers") && init?.method === "POST") {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "server_error", message: "boom" } }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
  useHandoverQueue.getState().enqueue(item);
  const submitted = await drainHandoverQueue();
  expect(submitted).toEqual([]);
  const stored = useHandoverQueue.getState().items;
  expect(stored).toHaveLength(1);
  expect(stored[0].status).toBe("failed");
});
