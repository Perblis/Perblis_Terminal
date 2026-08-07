// Cold-start session reconciliation (the "login again after reopening" bug):
// a stored refresh token must repopulate `me` without user action; no token
// means guest; a fetch failure keeps the persisted me (offline posture).
import { waitFor } from "@testing-library/react-native";

import { SessionHydrator } from "../../components/shell/session-hydrator";
import { clearTokens, setTokens } from "../../lib/api";
import type { Me } from "../../lib/types";
import { useSession } from "../../stores/session";
import { renderScreen } from "../render";

const ME = { id: "me1", full_name: "Ada Obi", email: "ada@e.com" } as Me;

beforeEach(async () => {
  await clearTokens();
  useSession.setState({ me: null, hydrated: false });
});

test("cold start with a stored refresh token fetches /me into the session store", async () => {
  await setTokens("access", "refresh");
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ME,
  })) as unknown as typeof fetch;

  await renderScreen(<SessionHydrator />);
  await waitFor(() => expect(useSession.getState().me?.id).toBe("me1"));
  expect(useSession.getState().hydrated).toBe(true);
});

test("cold start without tokens stays guest and marks hydrated", async () => {
  useSession.setState({ me: ME }); // stale persisted me from a prior account
  globalThis.fetch = jest.fn() as unknown as typeof fetch;

  await renderScreen(<SessionHydrator />);
  await waitFor(() => expect(useSession.getState().hydrated).toBe(true));
  expect(useSession.getState().me).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("offline cold start keeps the persisted me (fetchMe rejects)", async () => {
  await setTokens("access", "refresh");
  useSession.setState({ me: ME });
  globalThis.fetch = jest.fn(async () => {
    throw new Error("network request failed");
  }) as unknown as typeof fetch;

  await renderScreen(<SessionHydrator />);
  await waitFor(() => expect(useSession.getState().hydrated).toBe(true));
  expect(useSession.getState().me?.id).toBe("me1");
});
