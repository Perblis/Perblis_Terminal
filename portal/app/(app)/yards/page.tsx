"use client";

// P5 · Yards. Card grid with mini-maps (static — live MapLibre only in the
// modal, per the vision brief), delete-only-when-empty, cluster suggestions.
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GateIllustration } from "@/components/ui/system-illustrations";
import { YardModal } from "@/components/yards/yard-modal";
import { ApiError } from "@/lib/api";
import { useDeleteYard, useListings, useYards } from "@/lib/queries";
import type { Yard } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="skeleton h-32 w-full" />,
});

export default function YardsPage() {
  const yards = useYards();
  const listings = useListings();
  const deleteYard = useDeleteYard();
  const [modal, setModal] = useState<{ open: boolean; yard: Yard | null }>({
    open: false,
    yard: null,
  });
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

  // Auto-yard suggestion: ≥2 non-archived pin-located listings without a yard
  // within ~500m of each other (mirrors the backend's 100m inference spirit).
  const suggestion = useMemo(() => {
    const loose = (listings.data ?? []).filter(
      (l) => !l.yard_id && l.point && l.status !== "archived",
    );
    for (const a of loose) {
      const cluster = loose.filter((b) => {
        const [ax, ay] = a.point!.coordinates;
        const [bx, by] = b.point!.coordinates;
        return Math.hypot(ax - bx, ay - by) < 0.005; // ≈500m at Lagos latitude
      });
      if (cluster.length >= 2) return { count: cluster.length, near: a.city || a.address_text };
    }
    return null;
  }, [listings.data]);

  async function remove(yard: Yard) {
    setDeleteError(null);
    try {
      await deleteYard.mutateAsync(yard.id);
    } catch (e) {
      setDeleteError(
        e instanceof ApiError && e.code === "yard_has_listings"
          ? `“${yard.name}” still has listings. Move or archive them first — deleting a yard never deletes assets.`
          : "Couldn't delete the yard. Try again.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Yards"
        action={
          <Button onClick={() => setModal({ open: true, yard: null })}>
            <Plus size={16} aria-hidden /> New yard
          </Button>
        }
      />

      {deleteError ? (
        <Banner tone="warning" className="mb-s4">
          {deleteError}
        </Banner>
      ) : null}
      {suggestion ? (
        <Banner
          tone="info"
          className="mb-s4"
          action={
            <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, yard: null })}>
              Create a yard
            </Button>
          }
        >
          {suggestion.count} listings cluster near {suggestion.near || "the same spot"} — group
          them into a yard so they share one map pin.
        </Banner>
      ) : null}

      {yards.isPending ? (
        <div className="grid gap-s4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-0">
              <Skeleton className="h-32 w-full rounded-b-none rounded-t-md" />
              <div className="flex flex-col gap-s2 p-s4">
                <Skeleton className="h-s3 w-1/2" />
                <Skeleton className="h-s3 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : yards.isError ? (
        <Banner tone="danger">Couldn&apos;t load your yards. Refresh to try again.</Banner>
      ) : (yards.data ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-s3 p-s7 text-center">
          <GateIllustration />
          <p className="font-display text-h3 text-text-primary">No yards yet</p>
          <p className="max-w-sm text-body-sm text-text-secondary">
            A yard groups your assets at one address and puts a single pin on the map. Most
            suppliers start with their main depot.
          </p>
          <Button onClick={() => setModal({ open: true, yard: null })}>
            <Plus size={16} aria-hidden /> New yard
          </Button>
        </Card>
      ) : (
        <div className="grid gap-s4 sm:grid-cols-2 xl:grid-cols-3">
          {(yards.data ?? []).map((yard) => {
            const count = countByYard.get(yard.id) ?? 0;
            return (
              <Card key={yard.id} className="overflow-hidden p-0">
                <MapView
                  className="h-32 w-full"
                  center={[yard.point.coordinates[0], yard.point.coordinates[1]]}
                  marker={[yard.point.coordinates[0], yard.point.coordinates[1]]}
                  interactive={false}
                  zoom={13}
                />
                <div className="flex flex-col gap-s2 p-s4">
                  <div className="flex items-start justify-between gap-s2">
                    <h2 className="font-display text-h3 text-text-primary">{yard.name}</h2>
                    <span className="font-mono text-mono-sm text-text-secondary">
                      {count} {count === 1 ? "asset" : "assets"}
                    </span>
                  </div>
                  <p className="flex items-center gap-s1 text-body-sm text-text-secondary">
                    <MapPin size={14} className="shrink-0 text-ink-400" aria-hidden />
                    {yard.address_text || yard.city || "Pin only"}
                  </p>
                  <div className="mt-s2 flex gap-s2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setModal({ open: true, yard })}
                    >
                      <Pencil size={14} aria-hidden /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={count > 0}
                      title={count > 0 ? "Move or archive its listings first" : undefined}
                      onClick={() => remove(yard)}
                    >
                      <Trash2 size={14} aria-hidden /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <YardModal
        open={modal.open}
        yard={modal.yard}
        onClose={() => setModal({ open: false, yard: null })}
      />
    </>
  );
}
