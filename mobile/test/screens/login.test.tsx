// S2 login navigation: the reauth path must POP back to the interrupted
// screen (Profile pushes ?reauth=1 — the stuck-login-screen bug), a plain
// login replaces to the tabs, and a parked guest intent replays.
import { fireEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import Login from "../../app/auth/login";
import { clearTokens } from "../../lib/api";
import { consumePendingIntent, setPendingIntent } from "../../lib/guest-intent";
import { useSession } from "../../stores/session";
import { renderScreen } from "../render";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));

const ME = { id: "me1", full_name: "Ada Obi", email: "ada@e.com" };

beforeEach(async () => {
  mockParams = {};
  (router.back as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
  await clearTokens();
  useSession.setState({ me: null, hydrated: true });
  consumePendingIntent();
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/auth/login")) {
      return { ok: true, status: 200, json: async () => ({ access: "a", refresh: "r" }) } as unknown as Response;
    }
    if (u.endsWith("/me")) {
      return { ok: true, status: 200, json: async () => ME } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

async function submit(screen: Awaited<ReturnType<typeof renderScreen>>) {
  await fireEvent.changeText(screen.getByLabelText("Email"), "ada@e.com");
  await fireEvent.changeText(screen.getByLabelText("Password"), "correct-horse-9");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
}

test("reauth login pops back to the interrupted screen instead of replacing to tabs", async () => {
  mockParams = { reauth: "1" };
  const screen = await renderScreen(<Login />);
  await submit(screen);
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(router.replace).not.toHaveBeenCalled();
  expect(useSession.getState().me?.id).toBe("me1");
});

test("plain login replaces to the tabs", async () => {
  const screen = await renderScreen(<Login />);
  await submit(screen);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)"));
  expect(router.back).not.toHaveBeenCalled();
});

test("login replays a parked guest intent", async () => {
  setPendingIntent("/hire-request/l1");
  const screen = await renderScreen(<Login />);
  await submit(screen);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/hire-request/l1"));
});
