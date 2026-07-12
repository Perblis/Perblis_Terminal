// The supplier must be able to SEE what they are confirming: photos render
// from the record's presigned photo_urls (private bucket, D-025 — local-dev
// relative URLs ride the BFF, R2 presigned URLs pass through untouched) and
// readings render as labelled rows.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HandoverRecord } from "@/lib/types";

import { HandoverEvidence } from "./handover-evidence";

const record: HandoverRecord = {
  id: "hr1",
  hire: "h1",
  kind: "on_hire",
  photos: ["handovers/abc.jpg", "handovers/def.jpg"],
  photo_urls: [
    "/api/v1/media/private?t=token-abc",
    "https://acc.r2.cloudflarestorage.com/handovers/def.jpg?X-Amz-Signature=sig",
  ],
  reading: { hour_meter: "4021.5", notes: "Fuel at half tank" },
  submitted_by_role: "hirer",
  confirmed_at: null,
  photos_purged_at: null,
  created_at: "2026-07-01T09:15:00Z",
};

describe("HandoverEvidence", () => {
  it("renders thumbnails from presigned photo_urls (BFF for local, pass-through for R2)", () => {
    render(<HandoverEvidence record={record} />, { container: document.body.appendChild(document.createElement("ul")) });
    const thumbs = screen.getAllByRole("button", { name: /View handover photo/ });
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].querySelector("img")?.getAttribute("src")).toBe(
      "/bff/media/private?t=token-abc",
    );
    // R2 presigned URL keeps its signature — never rewritten to the public proxy.
    expect(thumbs[1].querySelector("img")?.getAttribute("src")).toBe(
      "https://acc.r2.cloudflarestorage.com/handovers/def.jpg?X-Amz-Signature=sig",
    );
  });

  it("renders labelled reading rows and the submitted-by line", () => {
    render(<HandoverEvidence record={record} />, { container: document.body.appendChild(document.createElement("ul")) });
    expect(screen.getByText("Hour meter")).toBeInTheDocument();
    expect(screen.getByText("4021.5")).toBeInTheDocument();
    expect(screen.getByText("Condition notes")).toBeInTheDocument();
    expect(screen.getByText("Fuel at half tank")).toBeInTheDocument();
    expect(screen.getByText(/Submitted by the hirer/)).toBeInTheDocument();
    expect(screen.getByText(/awaiting confirmation/)).toBeInTheDocument();
  });

  it("says so when no photos are attached", () => {
    render(<HandoverEvidence record={{ ...record, photos: [], photo_urls: [] }} />, {
      container: document.body.appendChild(document.createElement("ul")),
    });
    expect(screen.getByText("No photos attached.")).toBeInTheDocument();
  });

  it("shows the D-026 retention note once photos are purged", () => {
    render(
      <HandoverEvidence
        record={{ ...record, photos: [], photo_urls: [], photos_purged_at: "2026-11-01T00:00:00Z" }}
      />,
      { container: document.body.appendChild(document.createElement("ul")) },
    );
    expect(screen.getByText(/removed 90 days after off-hire/)).toBeInTheDocument();
  });
});
