// S10 handover evidence: thumbnails render from presigned photo_urls (D-025),
// the lightbox pages with a counter, and purged records (D-026) show the
// retention note instead of dead images.
import { fireEvent, render } from "@testing-library/react-native";

import { HandoverPhotoStrip } from "../../components/hires/handover-photo-strip";
import type { HandoverRecord } from "../../lib/types";

function record(overrides: Partial<HandoverRecord> = {}): HandoverRecord {
  return {
    id: "ho1",
    hire: "h1",
    kind: "on_hire",
    photos: ["handovers/a.jpg", "handovers/b.jpg"],
    photo_urls: [
      "https://r2.example/handovers/a.jpg?X-Amz-Signature=sig-a",
      "https://r2.example/handovers/b.jpg?X-Amz-Signature=sig-b",
    ],
    reading: {},
    submitted_by_role: "supplier",
    confirmed_at: null,
    photos_purged_at: null,
    created_at: "2026-08-10T09:00:00Z",
    ...overrides,
  };
}

test("renders a thumbnail per presigned URL, signature intact", async () => {
  const screen = await render(<HandoverPhotoStrip record={record()} />);
  expect(screen.getByLabelText("Handover photo 1 of 2")).toBeTruthy();
  expect(screen.getByLabelText("Handover photo 2 of 2")).toBeTruthy();
  // The presigned URL must reach <Image> untouched — no public-proxy rewrite.
  const tree = JSON.stringify(screen.toJSON());
  expect(tree).toContain("https://r2.example/handovers/a.jpg?X-Amz-Signature=sig-a");
  expect(tree).not.toContain("/api/v1/media/public");
});

test("tapping a thumb opens the lightbox with a pager counter", async () => {
  const screen = await render(<HandoverPhotoStrip record={record()} />);
  await fireEvent.press(screen.getByLabelText("Handover photo 2 of 2"));
  expect(screen.getByText("2 / 2")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Next photo")); // wraps to the first
  expect(screen.getByText("1 / 2")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Close photo viewer"));
  expect(screen.queryByText("1 / 2")).toBeNull();
});

test("purged record shows the D-026 retention note, no thumbnails", async () => {
  const purged = record({ photos: [], photo_urls: [], photos_purged_at: "2026-11-10T00:00:00Z" });
  const screen = await render(<HandoverPhotoStrip record={purged} />);
  expect(screen.getByText(/removed 90 days after off-hire/)).toBeTruthy();
  expect(screen.queryByLabelText(/Handover photo/)).toBeNull();
});
