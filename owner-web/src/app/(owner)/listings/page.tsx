"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/tds/EmptyState";
import { ListingCard } from "@/components/tds/ListingCard";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { listingsApi, type ListingFilters } from "@/lib/api/listings";
import {
  LISTING_STATUSES,
  QUERY_KEYS,
  RESOURCE_TYPES,
  type ListingStatus,
  type ResourceType,
} from "@/lib/constants";

const PAGE_SIZE = 24;

export default function ListingsIndexPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<ListingFilters>({
    page: 1,
    page_size: PAGE_SIZE,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: QUERY_KEYS.listings(filters),
    queryFn: () => listingsApi.list(filters),
  });

  const bulk = useMutation({
    mutationFn: (action: "activate" | "pause" | "archive") =>
      listingsApi.bulk(Array.from(selected), action),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  const toggle = (id: string, next: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });

  const hasSelection = selected.size > 0;
  const skipped = bulk.data?.skipped_listings ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Your fleet."
        actions={
          <Button asChild>
            <Link href="/listings/new">
              <Plus size={16} strokeWidth={1.5} aria-hidden /> New listing
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Status"
          value={filters.status ?? ""}
          onChange={(v) =>
            setFilters({
              ...filters,
              page: 1,
              status: (v || undefined) as ListingStatus | undefined,
            })
          }
          options={LISTING_STATUSES}
        />
        <FilterSelect
          label="Resource"
          value={filters.resource_type ?? ""}
          onChange={(v) =>
            setFilters({
              ...filters,
              page: 1,
              resource_type: (v || undefined) as ResourceType | undefined,
            })
          }
          options={RESOURCE_TYPES}
        />
        <div className="space-y-1">
          <label
            className="text-text-tertiary text-[11px] tracking-[0.06em] uppercase"
            htmlFor="city"
          >
            City
          </label>
          <Input
            id="city"
            placeholder="Lagos"
            value={filters.city ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                page: 1,
                city: e.target.value || undefined,
              })
            }
            className="w-[180px]"
          />
        </div>
      </div>

      {hasSelection ? (
        <div className="bg-surface-elevated border-border sticky top-14 z-10 -mx-5 flex items-center gap-3 border-y px-5 py-3 lg:-mx-8 lg:px-8">
          <span className="text-text-primary font-mono text-[13px]">{selected.size} selected</span>
          <div className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => bulk.mutate("activate")}
            disabled={bulk.isPending}
          >
            Activate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => bulk.mutate("pause")}
            disabled={bulk.isPending}
          >
            Pause
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => bulk.mutate("archive")}
            disabled={bulk.isPending}
          >
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {skipped.length > 0 ? (
        <div className="rounded-card border-amber-dim bg-amber-dim/40 border p-4">
          <div className="text-amber mb-2 text-[13px] font-medium tracking-[0.04em] uppercase">
            {skipped.length} skipped
          </div>
          <div className="text-text-secondary mb-2 font-mono text-[12px]">
            {bulk.data?.skipped_reason ?? "Skipped"}
          </div>
          <ul className="text-text-secondary space-y-1 font-mono text-[12px]">
            {skipped.map((title) => (
              <li key={title}>· {title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px]" />
          ))}
        </div>
      ) : q.data && q.data.results.length === 0 ? (
        <EmptyState
          title="No listings yet."
          hint="Add your first asset to start receiving requests."
          cta={{ label: "New listing", href: "/listings/new" }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data?.results.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              selectable
              selected={selected.has(l.id)}
              onSelect={toggle}
            />
          ))}
        </div>
      )}

      {q.data && q.data.count > (filters.page_size ?? PAGE_SIZE) ? (
        <div className="text-text-secondary flex items-center justify-between font-mono text-[12px]">
          <span>{q.data.count} total</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!q.data.previous}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) - 1 })}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!q.data.next}
              onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  const id = label.toLowerCase();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-text-tertiary text-[11px] tracking-[0.06em] uppercase">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-surface-elevated h-10 rounded border px-3 text-[14px]"
      >
        <option value="">All</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
