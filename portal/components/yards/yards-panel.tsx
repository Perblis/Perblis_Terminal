"use client";

// Yard management surfaced from the Assets page (not global nav).
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { toLngLat } from "@/lib/map-coords";
import { useDeleteYard, useListings, useYards } from "@/lib/queries";
import type { Yard } from "@/lib/types";

import { YardModal } from "./yard-modal";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="skeleton h-24 w-full rounded-sm" />,
});

export function YardsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const yards = useYards();
  const listings = useListings();
  const deleteYard = useDeleteYard();
  const [modal, setModal] = useState<{ open: boolean; yard: Yard | null }>({ open: false, yard: null });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const countByYard = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listings.data ?? []) {
      if (listing.yard_id && listing.status !== "archived") {
        counts.set(listing.yard_id, (counts.get(listing.yard_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [listings.data]);

  async function remove(yard: Yard) {
    setDeleteError(null);
    try {
      await deleteYard.mutateAsync(yard.id);
    } catch (e) {
      setDeleteError(
        e instanceof ApiError && e.code === "yard_has_listings"
          ? `“${yard.name}” still has listings. Move or archive them first.`
          : "Couldn't delete the yard. Try again.",
      );
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-s4"
        role="dialog"
        aria-modal="true"
        aria-label="Manage yards"
        onClick={onClose}
      >
        <Card
          className="flex max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border-default px-s5 py-s4">
            <div>
              <h2 className="font-display text-h3 text-text-primary">Yards</h2>
              <p className="text-caption text-ink-500">Group assets at a depot — one map pin per yard.</p>
            </div>
            <div className="flex items-center gap-s2">
              <Button size="sm" onClick={() => setModal({ open: true, yard: null })}>
                <Plus size={15} aria-hidden /> New yard
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-sm p-s1 text-ink-500 hover:bg-ink-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-s5">
            {deleteError ? <Banner tone="warning" className="mb-s4">{deleteError}</Banner> : null}
            {yards.isPending ? (
              <div className="flex flex-col gap-s3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : yards.isError ? (
              <Banner tone="danger">Couldn&apos;t load your yards. Refresh to try again.</Banner>
            ) : (yards.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-s3 py-s6 text-center">
                <p className="font-display text-h3 text-text-primary">No yards yet</p>
                <p className="max-w-sm text-body-sm text-text-secondary">
                  Pin your main depot — assets at the same spot can share one yard and one map pin.
                </p>
                <Button onClick={() => setModal({ open: true, yard: null })}>
                  <Plus size={16} aria-hidden /> New yard
                </Button>
              </div>
            ) : (
              <ul className="flex flex-col gap-s3">
                {(yards.data ?? []).map((yard) => {
                  const count = countByYard.get(yard.id) ?? 0;
                  const pin = toLngLat(yard.point?.coordinates);
                  return (
                    <li
                      key={yard.id}
                      className="flex gap-s3 overflow-hidden rounded-sm border border-border-default bg-surface-card"
                    >
                      {pin ? (
                        <MapView className="h-24 w-28 shrink-0" center={pin} marker={pin} interactive={false} zoom={13} />
                      ) : (
                        <div className="flex h-24 w-28 shrink-0 items-center justify-center bg-surface-sunken text-caption text-ink-500">
                          No pin
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-s1 py-s3 pr-s3">
                        <div className="flex items-start justify-between gap-s2">
                          <h3 className="font-medium text-text-primary">{yard.name}</h3>
                          <span className="shrink-0 font-mono text-mono-sm text-ink-500">
                            {count} {count === 1 ? "asset" : "assets"}
                          </span>
                        </div>
                        <p className="flex items-center gap-s1 text-caption text-ink-500">
                          <MapPin size={13} aria-hidden />
                          {yard.address_text || yard.city || "Pin only"}
                        </p>
                        <div className="mt-s1 flex gap-s2">
                          <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, yard })}>
                            <Pencil size={13} aria-hidden /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={count > 0 || deleteYard.isPending}
                            onClick={() => void remove(yard)}
                          >
                            <Trash2 size={13} aria-hidden /> Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <YardModal
        yard={modal.yard}
        open={modal.open}
        onClose={() => setModal({ open: false, yard: null })}
      />
    </>
  );
}
