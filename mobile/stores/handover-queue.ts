import { onlineManager } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { apiFetch } from "../lib/api";
import { uploadHandoverPhoto, type CapturedPhoto } from "../lib/media";
import type { HandoverRecord } from "../lib/types";
import { zustandStorage } from "../storage/mmkv";

// D-016: handover capture is the ONE mutation allowed offline. Photos + reading
// are captured in the field (often no signal) and queued locally as stable file
// URIs; the record submits when connectivity returns. Postgres is the record of
// truth — a queued item only becomes a HandoverRecord once the POST succeeds.

export type QueuedHandover = {
  id: string; // local id (never a server id)
  hireId: string;
  kind: "on_hire" | "off_hire";
  photos: CapturedPhoto[]; // local URIs survive restart (resume-safe, S11)
  reading: Record<string, unknown>;
  status: "queued" | "uploading" | "failed";
  error?: string;
  createdAt: number;
};

type HandoverQueueState = {
  items: QueuedHandover[];
  enqueue: (item: Omit<QueuedHandover, "id" | "status" | "createdAt">) => string;
  setStatus: (id: string, status: QueuedHandover["status"], error?: string) => void;
  remove: (id: string) => void;
};

function localId(): string {
  return `hq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useHandoverQueue = create<HandoverQueueState>()(
  persist(
    (set) => ({
      items: [],
      enqueue: (item) => {
        const id = localId();
        set((s) => ({
          items: [...s.items, { ...item, id, status: "queued", createdAt: Date.now() }],
        }));
        return id;
      },
      setStatus: (id, status, error) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, status, error } : it)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
    }),
    { name: "terminal.handover-queue", storage: createJSONStorage(() => zustandStorage) },
  ),
);

let draining = false;

/**
 * Uploads and submits every queued handover, oldest first. Returns the set of
 * hireIds that had a record submitted (for cache invalidation). No-ops when
 * offline or already draining. A successful POST removes the item immediately
 * (MMKV writes are synchronous) so a crash can't re-submit it.
 */
export async function drainHandoverQueue(): Promise<string[]> {
  if (draining) return [];
  if (!onlineManager.isOnline()) return [];
  draining = true;
  const submittedHireIds = new Set<string>();
  try {
    // Snapshot: enqueues during a drain are picked up on the next run.
    const pending = useHandoverQueue
      .getState()
      .items.filter((it) => it.status !== "uploading");
    for (const item of pending) {
      const { setStatus, remove } = useHandoverQueue.getState();
      setStatus(item.id, "uploading");
      try {
        const photos: string[] = [];
        for (const photo of item.photos) {
          photos.push(await uploadHandoverPhoto(photo));
        }
        await apiFetch<HandoverRecord>(`/hires/${item.hireId}/handovers`, {
          method: "POST",
          body: { kind: item.kind, photos, reading: item.reading },
        });
        remove(item.id);
        submittedHireIds.add(item.hireId);
      } catch (err) {
        setStatus(item.id, "failed", err instanceof Error ? err.message : "Upload failed");
      }
    }
  } finally {
    draining = false;
  }
  return [...submittedHireIds];
}
