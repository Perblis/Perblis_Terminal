"use client";

// P3 · Assets. Client-side DataTable over the whole fleet (@tanstack/react-table
// per D-020; GET /listings has no server filters — fleets are hundreds, not
// millions). Row actions per F9; pause/unpause gets the 6s undo toast.
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { Archive, Copy, MapPin, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { LostContainerIllustration } from "@/components/ui/system-illustrations";
import { YardsPanel } from "@/components/yards/yards-panel";
import { ASSET_CLASSES, CLASS_BY_VALUE } from "@/lib/asset-classes";
import { bff, mediaUrl } from "@/lib/api";
import { keys, useInvalidate, useListings, useYards } from "@/lib/queries";
import type { AssetClass, Listing, ListingStatus } from "@/lib/types";

const STATUS_EXPLAINER: Record<ListingStatus, string> = {
  draft: "Draft — only you can see it",
  live: "Live — visible on the map and in search",
  paused: "Paused — hidden from the map, hires unaffected",
  archived: "Archived — permanently off the market",
  removed: "Removed by Terminal — contact support",
};

const STATUS_STYLE: Record<ListingStatus, string> = {
  draft: "bg-ink-100 text-ink-600",
  live: "bg-green-600 text-paper-0",
  paused: "bg-amber-100 text-amber-900",
  archived: "border border-ink-300 text-ink-500",
  removed: "bg-red-50 text-red-900",
};

function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      title={STATUS_EXPLAINER[status]}
      className={`inline-flex rounded-pill px-s2 py-px text-caption font-medium ${STATUS_STYLE[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type UndoToast = { message: string; undo: () => void } | null;

export default function AssetsPage() {
  const router = useRouter();
  const listings = useListings();
  const yards = useYards();
  const invalidate = useInvalidate();

  const [yardsOpen, setYardsOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("yards") === "1") setYardsOpen(true);
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [yardFilter, setYardFilter] = useState("");
  const [groupByYard, setGroupByYard] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [toast, setToast] = useState<UndoToast>(null);
  const toastTimer = useRef<number | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Listing[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const yardName = useMemo(() => {
    const map = new Map<string, string>();
    for (const y of yards.data ?? []) map.set(y.id, y.name);
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "Pin only");
  }, [yards.data]);

  const data = useMemo(() => {
    let rows = (listings.data ?? []).filter((l) => l.status !== "removed" || true);
    if (statusFilter) rows = rows.filter((l) => l.status === statusFilter);
    if (classFilter) rows = rows.filter((l) => l.asset_class === classFilter);
    if (yardFilter) rows = rows.filter((l) => l.yard_id === yardFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (l) => l.title.toLowerCase().includes(q) || l.asset_type.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [listings.data, statusFilter, classFilter, yardFilter, search]);

  function showUndo(message: string, undo: () => void) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 6_000);
  }

  async function act(listing: Listing, action: "pause" | "publish" | "archive" | "duplicate") {
    setActionError(null);
    try {
      const result = await bff<Listing>(`/listings/${listing.id}/${action}`, { method: "POST" });
      await invalidate(keys.listings);
      if (action === "pause") {
        showUndo(`“${listing.title}” paused — hidden from the map.`, () => void act(listing, "publish"));
      }
      if (action === "duplicate") router.push(`/assets/${result.id}`);
    } catch {
      setActionError("That action failed. Refresh and try again.");
    }
  }

  const columnHelper = createColumnHelper<Listing>();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all"
            className="size-s4 accent-amber-500"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.title}`}
            className="size-s4 accent-amber-500"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      }),
      columnHelper.accessor("title", {
        header: "Asset",
        cell: ({ row }) => {
          const l = row.original;
          const cover = l.photos.find((p) => p.is_cover) ?? l.photos[0];
          const meta = CLASS_BY_VALUE[l.asset_class];
          const Glyph = CLASS_GLYPHS[l.asset_class];
          return (
            <Link href={`/assets/${l.id}`} className="flex items-center gap-s3 hover:underline">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- proxied via BFF
                <img src={mediaUrl(cover.url, cover.r2_key) ?? ""} alt="" className="size-s7 rounded-sm object-cover" />
              ) : (
                <span className={`grid size-s7 shrink-0 place-items-center rounded-sm ${meta.bg} ${meta.text}`}>
                  <Glyph size={18} />
                </span>
              )}
              <span>
                <span className="block max-w-[26ch] truncate font-medium text-text-primary">{l.title}</span>
                <span className="block text-caption text-ink-500">{l.asset_type}</span>
              </span>
            </Link>
          );
        },
      }),
      columnHelper.accessor("asset_class", {
        header: "Class",
        cell: ({ getValue }) => {
          const meta = CLASS_BY_VALUE[getValue() as AssetClass];
          return (
            <span className={`inline-flex items-center gap-s1 rounded-pill px-s2 py-px text-caption font-medium ${meta.bg} ${meta.text}`}>
              <span className={`size-s2 rounded-pill ${meta.dot}`} aria-hidden />
              {meta.label.split(" & ")[0]}
            </span>
          );
        },
      }),
      columnHelper.accessor("yard_id", {
        header: "Yard",
        cell: ({ getValue }) => <span className="text-body-sm text-text-secondary">{yardName(getValue())}</span>,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => <ListingStatusBadge status={getValue()} />,
      }),
      columnHelper.accessor("daily_price", {
        header: () => <span className="block text-right">Price/day</span>,
        cell: ({ row }) => (
          <Money display={row.original.daily_price_display ?? undefined} kobo={row.original.daily_price} className="block text-right text-mono" />
        ),
      }),
      columnHelper.accessor("unit_count", {
        header: () => <span className="block text-right">Units</span>,
        cell: ({ getValue }) => <span className="block text-right font-mono text-mono-sm">{getValue()}</span>,
      }),
      columnHelper.accessor("created_at", {
        header: "Created",
        cell: ({ getValue }) => (
          <span className="font-mono text-mono-sm text-ink-500">
            {new Date(getValue()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const l = row.original;
          return (
            <span className="flex justify-end gap-s1">
              <Link
                href={`/assets/${l.id}`}
                aria-label={`Edit ${l.title}`}
                className="rounded-sm p-s2 text-ink-500 hover:bg-ink-100 hover:text-text-primary"
              >
                <Pencil size={15} />
              </Link>
              <button
                type="button"
                aria-label={`Duplicate ${l.title}`}
                onClick={() => void act(l, "duplicate")}
                className="rounded-sm p-s2 text-ink-500 hover:bg-ink-100 hover:text-text-primary"
              >
                <Copy size={15} />
              </button>
              {l.status === "live" ? (
                <Button size="sm" variant="ghost" onClick={() => void act(l, "pause")}>
                  Pause
                </Button>
              ) : l.status === "paused" || l.status === "draft" ? (
                <Button size="sm" variant="ghost" onClick={() => void act(l, "publish")}>
                  {l.status === "paused" ? "Unpause" : "Publish"}
                </Button>
              ) : null}
              {l.status !== "archived" ? (
                <button
                  type="button"
                  aria-label={`Archive ${l.title}`}
                  onClick={() => setConfirmArchive([l])}
                  className="rounded-sm p-s2 text-ink-500 hover:bg-ink-100 hover:text-text-primary"
                >
                  <Archive size={15} />
                </button>
              ) : null}
            </span>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yardName],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection: selection },
    onSortingChange: setSorting,
    onRowSelectionChange: setSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);

  async function bulk(action: "pause" | "archive" | { yard: string }) {
    setActionError(null);
    try {
      if (typeof action === "string") {
        await Promise.all(
          selected
            .filter((l) => (action === "pause" ? l.status === "live" : l.status !== "archived"))
            .map((l) => bff(`/listings/${l.id}/${action}`, { method: "POST" })),
        );
      } else {
        await Promise.all(
          selected.map((l) =>
            bff(`/listings/${l.id}`, { method: "PATCH", body: JSON.stringify({ yard_id: action.yard }) }),
          ),
        );
      }
      setSelection({});
      await invalidate(keys.listings);
    } catch {
      setActionError("Some items failed — refresh to see the current state.");
    }
  }

  const groups = groupByYard
    ? [...new Set(table.getRowModel().rows.map((r) => r.original.yard_id))]
    : [null];

  return (
    <>
      <PageHeader
        title="Assets"
        action={
          <div className="flex flex-wrap gap-s2">
            <Button variant="secondary" onClick={() => setYardsOpen(true)}>
              <MapPin size={16} aria-hidden /> Yards
            </Button>
            <Button onClick={() => router.push("/assets/new")}>
              <Plus size={16} aria-hidden /> Add asset
            </Button>
          </div>
        }
      />

      {/* toolbar */}
      <div className="mb-s4 flex flex-wrap items-center gap-s2">
        <div className="flex h-9 min-w-56 items-center rounded-sm border border-border-default bg-surface-card px-s3">
          <Search size={15} className="mr-s2 text-ink-400" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or type"
            className="w-full bg-transparent text-body-sm outline-none placeholder:text-ink-400"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="h-9 rounded-sm border border-border-default bg-surface-card px-s2 text-body-sm">
          <option value="">All statuses</option>
          {["draft", "live", "paused", "archived"].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class" className="h-9 max-w-44 rounded-sm border border-border-default bg-surface-card px-s2 text-body-sm">
          <option value="">All classes</option>
          {ASSET_CLASSES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select value={yardFilter} onChange={(e) => setYardFilter(e.target.value)} aria-label="Filter by yard" className="h-9 max-w-40 rounded-sm border border-border-default bg-surface-card px-s2 text-body-sm">
          <option value="">All yards</option>
          {(yards.data ?? []).map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-s1 text-body-sm text-text-secondary">
          <input type="checkbox" className="size-s4 accent-amber-500" checked={groupByYard} onChange={(e) => setGroupByYard(e.target.checked)} />
          Group by yard
        </label>
        <Button size="sm" variant="ghost" onClick={() => setYardsOpen(true)} className="text-ink-500">
          <Plus size={14} aria-hidden /> New yard
        </Button>
        <span className="ml-auto text-caption text-ink-500">{data.length} assets</span>
      </div>

      {actionError ? <Banner tone="danger" className="mb-s3">{actionError}</Banner> : null}

      {selected.length > 0 ? (
        <div className="mb-s3 flex flex-wrap items-center gap-s2 rounded-sm bg-surface-inverse px-s3 py-s2 text-body-sm text-text-inverse">
          <span className="font-medium">{selected.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => void bulk("pause")}>Pause</Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirmArchive(selected)}>Archive</Button>
          <select
            aria-label="Assign to yard"
            defaultValue=""
            onChange={(e) => e.target.value && void bulk({ yard: e.target.value })}
            className="h-8 rounded-sm border border-ink-600 bg-ink-800 px-s2 text-body-sm text-text-inverse"
          >
            <option value="" disabled>Assign to yard…</option>
            {(yards.data ?? []).map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      {listings.isPending ? (
        <Card className="flex flex-col gap-s3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[var(--density-row-height)] w-full" />)}
        </Card>
      ) : listings.isError ? (
        <Banner tone="danger">Couldn&apos;t load your assets. Refresh to try again.</Banner>
      ) : data.length === 0 && !search && !statusFilter && !classFilter && !yardFilter ? (
        <Card className="flex flex-col items-center gap-s3 p-s7 text-center">
          <LostContainerIllustration />
          <p className="font-display text-h3 text-text-primary">List your first asset</p>
          <p className="max-w-sm text-body-sm text-text-secondary">Six steps, about ten minutes — then it&apos;s on the map for every hirer in Lagos.</p>
          <Button onClick={() => router.push("/assets/new")}><Plus size={16} aria-hidden /> Add asset</Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] border-collapse text-body-sm">
            <thead className="sticky top-0 bg-surface-page">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none border-b border-border-default px-s3 py-s2 text-left font-display text-overline uppercase tracking-[0.1em] text-ink-500"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {groups.map((groupYard) => {
              const rows = groupByYard
                ? table.getRowModel().rows.filter((r) => r.original.yard_id === groupYard)
                : table.getRowModel().rows;
              if (rows.length === 0) return null;
              return (
                <tbody key={groupYard ?? "all"}>
                  {groupByYard ? (
                    <tr>
                      <td colSpan={columns.length} className="bg-surface-sunken px-s3 py-s1 font-display text-overline uppercase tracking-[0.1em] text-ink-500">
                        {yardName(groupYard)}
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => (
                    <tr key={row.id} className="h-[var(--density-row-height)] border-b border-border-default last:border-0 hover:bg-ink-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-s3 py-[var(--density-cell-pad)]">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </Card>
      )}

      {/* archive confirm (07 §6 destructive pattern) */}
      {confirmArchive ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-s4" role="dialog" aria-modal="true" aria-label="Confirm archive">
          <Card className="w-full max-w-md p-s5">
            <h2 className="font-display text-h3 text-text-primary">
              Archive {confirmArchive.length === 1 ? `“${confirmArchive[0].title}”` : `${confirmArchive.length} assets`}?
            </h2>
            <p className="mt-s2 text-body-sm text-text-secondary">
              Archived assets leave the market permanently — hire history stays, but the listing can&apos;t be re-published. This can&apos;t be undone.
            </p>
            <div className="mt-s4 flex justify-end gap-s2">
              <Button variant="secondary" onClick={() => setConfirmArchive(null)}>Keep listing</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const targets = confirmArchive;
                  setConfirmArchive(null);
                  if (targets.length === 1) await act(targets[0], "archive");
                  else {
                    setSelection({});
                    await Promise.all(targets.map((l) => bff(`/listings/${l.id}/archive`, { method: "POST" })));
                    await invalidate(keys.listings);
                  }
                }}
              >
                Archive
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {/* undo toast (05 §4: portal bottom-right) */}
      {toast ? (
        <div className="fixed bottom-s4 right-s4 z-50 flex items-center gap-s3 rounded-sm bg-surface-inverse px-s4 py-s3 text-body-sm text-text-inverse shadow-e2">
          <span>{toast.message}</span>
          <button
            type="button"
            className="font-medium text-amber-500 underline"
            onClick={() => {
              toast.undo();
              setToast(null);
            }}
          >
            Undo
          </button>
        </div>
      ) : null}

      <YardsPanel open={yardsOpen} onClose={() => setYardsOpen(false)} />
    </>
  );
}
