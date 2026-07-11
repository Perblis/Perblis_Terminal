// The supplier must be able to SEE what they are confirming: photos ride the
// BFF public-media proxy and readings render as labelled rows.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HandoverRecord } from "@/lib/types";

import { HandoverEvidence } from "./handover-evidence";

const record: HandoverRecord = {
  id: "hr1",
  hire: "h1",
  kind: "on_hire",
  photos: ["handovers/abc.jpg", "handovers/def.jpg"],
  reading: { hour_meter: "4021.5", notes: "Fuel at half tank" },
  submitted_by_role: "hirer",
  confirmed_at: null,
  created_at: "2026-07-01T09:15:00Z",
};

describe("HandoverEvidence", () => {
  it("renders photo thumbnails through the BFF media proxy", () => {
    render(<HandoverEvidence record={record} />, { container: document.body.appendChild(document.createElement("ul")) });
    const thumbs = screen.getAllByRole("button", { name: /View handover photo/ });
    expect(thumbs).toHaveLength(2);
    const img = thumbs[0].querySelector("img");
    expect(img?.getAttribute("src")).toBe("/bff/media/public?key=handovers%2Fabc.jpg");
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
    render(<HandoverEvidence record={{ ...record, photos: [] }} />, {
      container: document.body.appendChild(document.createElement("ul")),
    });
    expect(screen.getByText("No photos attached.")).toBeInTheDocument();
  });
});
