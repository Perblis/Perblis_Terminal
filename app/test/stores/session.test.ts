// The session store persists `me` to MMKV so a cold (even offline) start
// renders the signed-in posture on first frame — the restart-to-login bug.
import { mmkv } from "../../storage/mmkv";
import { useSession } from "../../stores/session";
import type { Me } from "../../lib/types";

const ME = { id: "me1", full_name: "Ada Obi", email: "ada@e.com" } as Me;

beforeEach(() => {
  useSession.setState({ me: null, hydrated: false });
});

test("setMe persists me to MMKV under terminal.session (offline cold-start posture)", () => {
  useSession.getState().setMe(ME);
  const raw = mmkv.getString("terminal.session");
  expect(raw).toBeTruthy();
  expect(JSON.parse(raw!).state.me.id).toBe("me1");
});

test("setMe(null) clears the persisted session", () => {
  useSession.getState().setMe(ME);
  useSession.getState().setMe(null);
  const raw = mmkv.getString("terminal.session");
  expect(JSON.parse(raw!).state.me).toBeNull();
});

test("hydrated is per-launch state and never persisted", () => {
  useSession.getState().setMe(ME);
  useSession.getState().setHydrated();
  const raw = mmkv.getString("terminal.session");
  expect(JSON.parse(raw!).state.hydrated).toBeUndefined();
});
