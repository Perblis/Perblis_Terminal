// S16 Profile — Verify CTA when Basic, Become-a-supplier hand-off (F8), sign out.
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import ProfileTab from "../../app/(tabs)/profile";
import * as authApi from "../../lib/auth-api";
import type { Me } from "../../lib/types";
import { useSession } from "../../stores/session";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0" }));
jest.spyOn(authApi, "logout").mockResolvedValue(undefined);

const ME: Me = { id: "me1", full_name: "Ada Obi", email: "ada@e.com", phone: "0800", is_supplier: false, is_hirer: true, account_level: "basic", is_phone_verified: true, is_email_verified: true, is_verified: false } as Me;

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
  useSession.setState({ me: { ...ME }, hydrated: true });
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/me/verification")) {
      return { ok: true, status: 200, json: async () => ({ account_level: "basic", requests: [] }) } as unknown as Response;
    }
    if (u.includes("/me/become-supplier") && init?.method === "POST") {
      // The real endpoint returns the full MeSerializer — the store consumes it.
      return { ok: true, status: 200, json: async () => ({ ...ME, is_supplier: true }) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
});

test("Basic account shows the Verify CTA → routes to /verify", async () => {
  const screen = await renderScreen(<ProfileTab />);
  expect(await screen.findByText("Verify your account")).toBeTruthy();
  await fireEvent.press(screen.getByText("Verify"));
  expect(router.push).toHaveBeenCalledWith("/verify");
});

test("Become a supplier activates + confirms the emailed portal link (F8)", async () => {
  const screen = await renderScreen(<ProfileTab />);
  await fireEvent.press(await screen.findByText("Become a supplier"));
  expect(await screen.findByText(/Portal link sent to your email/)).toBeTruthy();
  // The session store is the single source of truth for me — the activation
  // must reflect immediately, not after an app restart.
  expect(useSession.getState().me?.is_supplier).toBe(true);
});

test("guest Profile waits for hydration before showing the sign-in CTA", async () => {
  useSession.setState({ me: null, hydrated: false });
  const screen = await renderScreen(<ProfileTab />);
  expect(screen.queryByText(/browsing as a guest/)).toBeNull();
  await act(async () => useSession.setState({ hydrated: true }));
  expect(await screen.findByText(/browsing as a guest/)).toBeTruthy();
});

test("Sign out clears the session and returns to the tabs", async () => {
  const screen = await renderScreen(<ProfileTab />);
  await fireEvent.press(await screen.findByText("Sign out"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)"));
  expect(useSession.getState().me).toBeNull();
});
