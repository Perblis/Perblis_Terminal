"use client";

// P5 create/edit yard modal: name + LocationIQ search (via /bff/geocode) with
// pin-drop correction as the PRIMARY location method (J1's failure point —
// geocoding Nigerian industrial addresses is unreliable; the pin is truth).
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiError } from "@/lib/api";
import { geocode, useCreateYard, useUpdateYard } from "@/lib/queries";
import type { GeocodeResult, Yard } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="skeleton h-64 w-full rounded-sm" />,
});

export function YardModal({
  yard,
  open,
  onClose,
}: {
  /** Present = edit mode. */
  yard?: Yard | null;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [city, setCity] = useState("");
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createYard = useCreateYard();
  const updateYard = useUpdateYard();
  const busy = createYard.isPending || updateYard.isPending;

  useEffect(() => {
    if (open) {
      setName(yard?.name ?? "");
      setAddressText(yard?.address_text ?? "");
      setCity(yard?.city ?? "");
      setPoint(yard ? [yard.point.coordinates[0], yard.point.coordinates[1]] : null);
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open, yard]);

  async function runSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const resp = await geocode(query.trim());
      setResults(resp.results);
      if (!resp.provider_configured) {
        setError("Address search is unavailable right now — drop the pin instead.");
      } else if (resp.results.length === 0) {
        setError("No matches — drop the pin on the map instead.");
      } else {
        setError(null);
      }
    } catch {
      setError("Search failed — drop the pin on the map instead.");
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("Give the yard a name.");
      return;
    }
    if (!point) {
      setError("Drop a pin where the yard is — search or click the map.");
      return;
    }
    const body = {
      name: name.trim(),
      point: { type: "Point", coordinates: point },
      address_text: addressText,
      city,
    };
    try {
      if (yard) {
        await updateYard.mutateAsync({ id: yard.id, ...body } as never);
      } else {
        await createYard.mutateAsync(body);
      }
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the yard. Try again.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface-card p-s5 shadow-e2">
          <div className="flex items-start justify-between">
            <Dialog.Title className="font-display text-h3 text-text-primary">
              {yard ? "Edit yard" : "New yard"}
            </Dialog.Title>
            <Dialog.Close aria-label="Close" className="rounded-sm p-s1 text-ink-500 hover:bg-ink-100">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="mt-s4 flex flex-col gap-s4">
            <TextField
              label="Yard name"
              placeholder="Apapa depot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="flex flex-col gap-s2">
              <label className="text-caption font-medium text-text-secondary">Location</label>
              <div className="flex gap-s2">
                <div className="flex h-10 flex-1 items-center rounded-sm border border-border-default bg-surface-card px-s3">
                  <Search size={16} className="mr-s2 shrink-0 text-ink-400" aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                    placeholder="Search an address or area"
                    className="w-full bg-transparent text-body-sm outline-none placeholder:text-ink-500"
                  />
                </div>
                <Button variant="secondary" onClick={runSearch} loading={searching}>
                  Search
                </Button>
              </div>
              {results.length > 0 ? (
                <ul className="max-h-32 overflow-y-auto rounded-sm border border-border-default">
                  {results.map((r) => (
                    <li key={`${r.lat}-${r.lng}`}>
                      <button
                        type="button"
                        className="w-full px-s3 py-s2 text-left text-body-sm hover:bg-ink-50"
                        onClick={() => {
                          setPoint([r.lng, r.lat]);
                          setAddressText(r.display_name);
                          setResults([]);
                          setQuery("");
                        }}
                      >
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <MapView
                className="h-64 w-full overflow-hidden rounded-sm border border-border-default"
                center={point ?? undefined}
                marker={point}
                onPick={(lngLat) => {
                  setPoint(lngLat);
                  setError(null);
                }}
              />
              <p className="text-caption text-ink-500">
                Click the map or drag the pin — the pin is what hirers navigate to, not the address
                text.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-s3">
              <TextField
                label="Address (display)"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="Apapa Industrial Estate"
              />
              <TextField
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lagos"
              />
            </div>

            {error ? (
              <p className="text-body-sm text-text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-s3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} loading={busy}>
                Save yard
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
