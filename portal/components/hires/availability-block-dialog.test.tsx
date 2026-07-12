// D-024 block dialogs: create posts the chosen listing + range, remove
// releases the dates — both close on success.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AvailabilityBlock, Listing } from "@/lib/types";

import { AvailabilityBlockDialog, RemoveBlockDialog } from "./availability-block-dialog";

const createMutateAsync = vi.fn(async () => ({}));
const deleteMutateAsync = vi.fn(async () => undefined);

vi.mock("@/lib/queries", () => ({
  useCreateAvailabilityBlock: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useDeleteAvailabilityBlock: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));

const LISTINGS = [
  { id: "l1", title: "CAT 320D — 20t Excavator" },
  { id: "l2", title: "Sinotruk HOWO 30t" },
] as Listing[];

const BLOCK: AvailabilityBlock = {
  id: "b1",
  listing_id: "l1",
  start_date: "2026-08-10",
  end_date: "2026-08-12",
  reason: "maintenance",
  created_at: "2026-08-01T00:00:00Z",
};

describe("AvailabilityBlockDialog", () => {
  it("posts the chosen asset + range and closes", async () => {
    const onClose = vi.fn();
    render(<AvailabilityBlockDialog open listings={LISTINGS} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Asset"), { target: { value: "l2" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "maintenance" } });
    fireEvent.click(screen.getByRole("button", { name: "Block dates" }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith({
        listingId: "l2",
        start_date: "2026-08-10",
        end_date: "2026-08-12",
        reason: "maintenance",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the submit disabled until both dates are set", () => {
    render(<AvailabilityBlockDialog open listings={LISTINGS} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Block dates" })).toBeDisabled();
  });
});

describe("RemoveBlockDialog", () => {
  it("shows the block's range and removes it", async () => {
    const onClose = vi.fn();
    render(<RemoveBlockDialog block={BLOCK} listingTitle="CAT 320D — 20t Excavator" onClose={onClose} />);

    expect(screen.getByText(/2026-08-10 → 2026-08-12/)).toBeInTheDocument();
    expect(screen.getByText(/maintenance/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove block" }));

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith("b1"));
    expect(onClose).toHaveBeenCalled();
  });
});
