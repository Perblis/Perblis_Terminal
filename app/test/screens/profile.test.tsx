// S16 Profile — Verify CTA when Basic, Become-a-supplier hand-off (F8), sign out.
import { fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";

import ProfileTab from "../../app/(tabs)/profile";
import { PORTAL_URL } from "../../lib/api";
import * as authApi from "../../lib/auth-api";
import { useSession } from "../../stores/session";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0" }));
jest.spyOn(authApi, "logout").mockResolvedValue(undefined);

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
  useSession.setState({
    me: { id: "me1", full_name: "Ada Obi", email: "ada@e.com", phone: "0800", is_supplier: false, is_hirer: true, account_level: "basic", is_phone_verified: true, is_email_verified: true, is_verified: false },
  });
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/me/verification")) {
      return { ok: true, status: 200, json: async () => ({ account_level: "basic", requests: [] }) } as unknown as Response;
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

test("Become a supplier hands off to the portal (F8)", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const screen = await renderScreen(<ProfileTab />);
  await fireEvent.press(await screen.findByText("Become a supplier"));
  expect(open).toHaveBeenCalledWith(PORTAL_URL);
});

test("Sign out clears the session and returns to the tabs", async () => {
  const screen = await renderScreen(<ProfileTab />);
  await fireEvent.press(await screen.findByText("Sign out"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)"));
  expect(useSession.getState().me).toBeNull();
});
