// F2 verification submit — failures must be visible (the "Upload does
// nothing" bug was every error being swallowed), and picked documents are
// downscaled under the server's 5 MB/doc cap before attach.
import { fireEvent, waitFor } from "@testing-library/react-native";
import { ImageManipulator } from "expo-image-manipulator";

import Verify from "../../app/verify";
import { renderScreen } from "../render";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

function stubSubmit(status: number, body: unknown) {
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/me/verification") && init?.method === "POST") {
      return { ok: status < 400, status, json: async () => body } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
}

async function addDocAndSubmit(screen: Awaited<ReturnType<typeof renderScreen>>) {
  await fireEvent.press(await screen.findByText("Add document"));
  await screen.findAllByRole("image" as never).catch(() => null);
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Submit for review" }));
}

test("a rejected submission surfaces the server's message", async () => {
  stubSubmit(400, {
    error: { code: "verification_doc_invalid", message: "Each document must be 5 MB or less." },
  });
  const screen = await renderScreen(<Verify />);
  await addDocAndSubmit(screen);
  expect(await screen.findByText(/5 MB or less/)).toBeTruthy();
});

test("a successful submission shows the review confirmation", async () => {
  stubSubmit(201, { id: "vr1", kind: "identity", state: "pending" });
  const screen = await renderScreen(<Verify />);
  await addDocAndSubmit(screen);
  expect(await screen.findByText("Documents submitted")).toBeTruthy();
});

test("picked documents are downscaled before submit", async () => {
  stubSubmit(201, { id: "vr1", kind: "identity", state: "pending" });
  const screen = await renderScreen(<Verify />);
  await fireEvent.press(await screen.findByText("Add document"));
  await waitFor(() => expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///lib.jpg"));
});
