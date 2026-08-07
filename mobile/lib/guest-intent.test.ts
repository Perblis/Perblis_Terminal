import { consumePendingIntent, guardIntent, hasPendingIntent, setPendingIntent } from "./guest-intent";

beforeEach(() => {
  consumePendingIntent(); // drain
});

test("signed-in users proceed without storing an intent", () => {
  const result = guardIntent(true, "/listing/abc");
  expect(result.proceed).toBe(true);
  expect(hasPendingIntent()).toBe(false);
});

test("guests are routed to auth and the intent is preserved", () => {
  const result = guardIntent(false, "/hire-request/abc");
  expect(result).toEqual({ proceed: false, authHref: "/auth/login" });
  expect(consumePendingIntent()).toBe("/hire-request/abc");
});

test("intent is consume-on-read (never replays)", () => {
  setPendingIntent("/listing/xyz");
  expect(consumePendingIntent()).toBe("/listing/xyz");
  expect(consumePendingIntent()).toBeNull();
});

test("a newer intent replaces an older one", () => {
  setPendingIntent("/listing/old");
  setPendingIntent("/listing/new");
  expect(consumePendingIntent()).toBe("/listing/new");
});
