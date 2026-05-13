# TERMINAL OWNER WEB — WAVE 05: MESSAGING

> Agent task file. Execute every instruction in order. Do not skip steps.
> Do not proceed to Wave 06 until the Definition of Done checklist is fully complete.

---

## Context

This wave delivers the **messaging** surface: a Slack-style two-pane inbox where the owner can see all threads, open one, and chat with a renter in real time over Ably.

1. **Thread list** — `GET /api/v1/threads/` with `has_unread` and `type` filters. Each row shows the other participant, the listing context, the last message preview, the unread badge, and the relative timestamp.
2. **Thread view** — `GET /api/v1/threads/{id}/` auto-marks unread messages from the other party as read. Messages are paginated newest-first; the UI renders them oldest-first (chronological). Send messages via `POST /api/v1/threads/{id}/messages/`. Mark-read manually via `PATCH /api/v1/threads/{id}/read/` when re-opening a thread.
3. **Realtime** — `POST /api/v1/threads/token/` returns an Ably token. Subscribe to the thread's channel; new messages from the renter appear instantly. The Ably channel name is the thread ID by convention (verify against the backend Ably token claims — adjust if it scopes differently).

---

## Step 1: Messaging API module

**File: `src/lib/api/messaging.ts`**

```typescript
import { apiClient } from "./client";

export type ThreadType = "inquiry" | "booking";

export type ThreadSummary = {
  id: string;
  type: ThreadType;
  listing_id: string | null;
  listing_title: string | null;
  other_participant: {
    id: string;
    name: string;
    photo: string | null;
  };
  last_message: {
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
    is_read: boolean;
  } | null;
  unread_count: number;
  updated_at: string;
};

export type Message = {
  id: string;
  sender: { id: string; name: string; photo: string | null };
  body: string;
  is_read: boolean;
  created_at: string;
};

export type ThreadDetail = {
  thread: ThreadSummary & { booking_id: string | null };
  messages: Message[];
  next: string | null;
  previous: string | null;
};

export const messagingApi = {
  listThreads: (filters: { type?: ThreadType; has_unread?: boolean } = {}) =>
    apiClient.get<{ count: number; results: ThreadSummary[] }>("/threads/", {
      query: filters as Record<string, string | number | boolean | undefined | null>,
    }),

  getThread: (id: string) => apiClient.get<ThreadDetail>(`/threads/${id}/`),

  send: (id: string, body: string) =>
    apiClient.post<Message>(`/threads/${id}/messages/`, { body }),

  markRead: (id: string) => apiClient.patch<{ success: true }>(`/threads/${id}/read/`),

  createInquiry: (listing_id: string, initial_message: string) =>
    apiClient.post<{ thread_id: string }>("/threads/", { listing_id, initial_message }),

  ablyToken: () => apiClient.post<{ success: true; token: string }>("/threads/token/"),
};
```

> If the backend response wraps things in `{success, data}`, adjust the typed result. Verify against `/api/schema/` after Wave 00's `gen:api` ran.

---

## Step 2: Ably client + hook

**File: `src/hooks/useAbly.ts`**

```typescript
"use client";

import { useEffect, useRef } from "react";
import * as Ably from "ably";
import { messagingApi } from "@/lib/api/messaging";

let clientPromise: Promise<Ably.Realtime> | null = null;

async function getAblyClient(): Promise<Ably.Realtime> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const tokenFetcher = async () => {
      const res = await messagingApi.ablyToken();
      return res.token;
    };
    const client = new Ably.Realtime({
      authCallback: async (_data, cb) => {
        try {
          const token = await tokenFetcher();
          cb(null, token);
        } catch (err) {
          cb(err as Error, null);
        }
      },
      autoConnect: true,
    });
    return client;
  })();
  return clientPromise;
}

export function useAblyChannel(channelName: string | null, onMessage: (msg: Ably.Message) => void) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!channelName) return;
    let cancelled = false;
    let channel: Ably.RealtimeChannel | null = null;
    let client: Ably.Realtime | null = null;
    const listener = (m: Ably.Message) => handlerRef.current(m);

    (async () => {
      client = await getAblyClient();
      if (cancelled) return;
      channel = client.channels.get(channelName);
      channel.subscribe(listener);
    })();

    return () => {
      cancelled = true;
      if (channel) channel.unsubscribe(listener);
    };
  }, [channelName]);
}
```

> **Channel naming:** the Ably token issued by the backend almost certainly scopes capabilities to specific channels (e.g. `thread-{id}`). Confirm by inspecting the JWT in `/threads/token/` — adjust the `channelName` argument below accordingly. The component below assumes `thread-{thread_id}`.

---

## Step 3: TDS message bubble component

**File: `src/components/tds/MessageBubble.tsx`**

```typescript
import { cn } from "@/lib/cn";

export function MessageBubble({
  body,
  fromMe,
  timestamp,
}: {
  body: string;
  fromMe: boolean;
  timestamp: string;
}) {
  return (
    <div className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
      <div className="max-w-[78%] space-y-1">
        <div
          className={cn(
            "rounded-card px-3 py-2 text-[14px] font-body whitespace-pre-line",
            fromMe
              ? "bg-forge-dim text-text-primary border border-forge-dim"
              : "bg-surface text-text-primary border border-border",
          )}
        >
          {body}
        </div>
        <div
          className={cn(
            "font-mono text-[10px] text-text-tertiary",
            fromMe ? "text-right" : "text-left",
          )}
        >
          {new Date(timestamp).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 4: Threads layout (two-pane)

**File: `src/app/(owner)/messages/layout.tsx`**

```typescript
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { messagingApi } from "@/lib/api/messaging";
import { QUERY_KEYS } from "@/lib/constants";
import { Avatar } from "@/components/tds/Avatar";
import { Badge } from "@/components/tds/Badge";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { EmptyState } from "@/components/tds/EmptyState";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams() as { id?: string };
  const openId = params.id;

  const q = useQuery({
    queryKey: QUERY_KEYS.threads,
    queryFn: () => messagingApi.listThreads(),
    refetchInterval: 30_000,
  });

  // On mobile, hide the list when a thread is open and vice versa
  const isThreadOpen = pathname !== "/messages";

  return (
    <div className="-mx-5 lg:-mx-8 h-[calc(100vh-3.5rem)] flex">
      <aside
        className={cn(
          "w-full lg:w-[320px] shrink-0 border-r border-border bg-abyss overflow-y-auto",
          isThreadOpen ? "hidden lg:block" : "block",
        )}
      >
        <div className="px-5 py-4 border-b border-border">
          <h1 className="font-display uppercase text-[22px] leading-none">Inbox</h1>
        </div>

        {q.isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px]" />
            ))}
          </div>
        ) : !q.data || q.data.results.length === 0 ? (
          <EmptyState title="No conversations yet." />
        ) : (
          <ul>
            {q.data.results.map((t) => {
              const active = openId === t.id;
              return (
                <li key={t.id}>
                  <Link
                    href={`/messages/${t.id}`}
                    className={cn(
                      "flex items-start gap-3 px-5 py-3 border-b border-border hover:bg-surface-high transition-colors duration-fast",
                      active && "bg-surface-high border-l-[3px] border-l-forge pl-[17px]",
                    )}
                  >
                    <Avatar src={t.other_participant.photo} name={t.other_participant.name} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body font-semibold text-[14px] truncate">
                          {t.other_participant.name}
                        </span>
                        <span className="font-mono text-[10px] text-text-tertiary shrink-0">
                          {t.last_message ? formatRelativeTime(t.last_message.created_at) : ""}
                        </span>
                      </div>
                      {t.listing_title ? (
                        <div className="text-[11px] text-text-tertiary truncate">
                          {t.listing_title}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[13px] text-text-secondary truncate">
                          {t.last_message?.body ?? "—"}
                        </p>
                        {t.unread_count > 0 ? (
                          <Badge tone="accent">{t.unread_count}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section
        className={cn(
          "flex-1 min-w-0",
          isThreadOpen ? "block" : "hidden lg:flex lg:items-center lg:justify-center",
        )}
      >
        {isThreadOpen ? (
          children
        ) : (
          <div className="text-text-tertiary text-[13px] flex flex-col items-center gap-2">
            <MessageSquare size={32} strokeWidth={1.5} />
            <span>Select a conversation.</span>
          </div>
        )}
      </section>
    </div>
  );
}
```

---

## Step 5: Threads index (mobile empty state, desktop "select a conversation")

**File: `src/app/(owner)/messages/page.tsx`** (replace stub)

```typescript
export default function MessagesIndexPage() {
  // Layout handles the empty desktop pane. On mobile, the layout shows only the list — so this page is intentionally empty.
  return null;
}
```

---

## Step 6: Thread page

**File: `src/app/(owner)/messages/[id]/page.tsx`**

```typescript
"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Send } from "lucide-react";
import { messagingApi, type Message } from "@/lib/api/messaging";
import { QUERY_KEYS } from "@/lib/constants";
import { Avatar } from "@/components/tds/Avatar";
import { MessageBubble } from "@/components/tds/MessageBubble";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/tds/LoadingSkeleton";
import { useMe } from "@/hooks/useAuth";
import { useAblyChannel } from "@/hooks/useAbly";

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const me = useMe();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: QUERY_KEYS.thread(id),
    queryFn: () => messagingApi.getThread(id),
  });

  // Auto-mark read on open (server also does it, but invalidates the unread badge in the list)
  useEffect(() => {
    messagingApi.markRead(id).catch(() => undefined);
    qc.invalidateQueries({ queryKey: QUERY_KEYS.threads });
  }, [id, qc]);

  // Realtime: append incoming messages
  useAblyChannel(`thread-${id}`, (msg) => {
    const payload = msg.data as Message | { message: Message };
    const m = "message" in payload ? payload.message : (payload as Message);
    if (!m?.id) return;
    qc.setQueryData<typeof q.data>(QUERY_KEYS.thread(id), (prev) => {
      if (!prev) return prev;
      if (prev.messages.some((x) => x.id === m.id)) return prev;
      return { ...prev, messages: [...prev.messages, m] };
    });
  });

  const send = useMutation({
    mutationFn: () => messagingApi.send(id, draft.trim()),
    onSuccess: (msg) => {
      qc.setQueryData<typeof q.data>(QUERY_KEYS.thread(id), (prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
      setDraft("");
      qc.invalidateQueries({ queryKey: QUERY_KEYS.threads });
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [q.data?.messages.length]);

  if (q.isLoading) return <Skeleton className="h-full" />;
  if (!q.data) return null;

  const t = q.data.thread;
  const myId = me.data?.id;

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 px-4 lg:px-6 border-b border-border flex items-center gap-3 shrink-0">
        <Link href="/messages" className="lg:hidden text-text-secondary">
          <ChevronLeft size={20} strokeWidth={1.5} />
        </Link>
        <Avatar src={t.other_participant.photo} name={t.other_participant.name} size={32} />
        <div className="min-w-0">
          <div className="font-body font-semibold text-[14px] truncate">
            {t.other_participant.name}
          </div>
          {t.listing_title ? (
            <Link
              href={t.listing_id ? `/listings/${t.listing_id}` : "#"}
              className="text-[11px] text-text-tertiary truncate hover:text-text-secondary"
            >
              {t.listing_title}
            </Link>
          ) : null}
        </div>
        {t.booking_id ? (
          <Link
            href={`/bookings/${t.booking_id}`}
            className="ml-auto text-[12px] text-forge"
          >
            View booking
          </Link>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 space-y-3 bg-abyss"
      >
        {q.data.messages.map((m) => (
          <MessageBubble
            key={m.id}
            body={m.body}
            fromMe={m.sender.id === myId}
            timestamp={m.created_at}
          />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          send.mutate();
        }}
        className="border-t border-border p-3 lg:p-4 flex items-end gap-2 bg-abyss"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (draft.trim()) send.mutate();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded border border-border bg-surface-elevated px-3 py-2 text-[14px] font-body min-h-[40px] max-h-[160px] focus:outline-none focus:border-border-active"
        />
        <Button type="submit" disabled={!draft.trim() || send.isPending}>
          <Send size={16} strokeWidth={1.5} />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
```

---

## Step 7: Smoke test

Backend running with at least 2 threads for the owner (one with unread messages, one without). Mobile renter app or a second browser logged in as the renter to send messages live.

```bash
npm run dev
```

1. `/messages` shows the thread list. Unread badges render as accent pills.
2. Click a thread → desktop: opens in the right pane; mobile: thread fills the screen with a back arrow that returns to the list.
3. Messages render in chronological order. Own messages right-aligned with `forge-dim` background; renter messages left-aligned with `surface` background.
4. Typing in the box and pressing **Enter** sends a message. **Shift+Enter** inserts a newline.
5. Auto-scroll lands at the bottom when a new message arrives.
6. From the renter's account, send a message → it appears in the owner's open thread within ~1 second (Ably realtime).
7. Unread badges on other threads update when new messages arrive (the `useQuery` 30s poll catches non-realtime updates; Ably handles the instant case for the open thread).
8. Returning to the inbox after viewing a thread shows the unread count cleared for that thread.
9. Click the listing title in the header → routes to `/listings/{id}`. Click "View booking" when present → routes to `/bookings/{booking_id}`.

---

## Step 8: Commit

```bash
git add owner-web/src
git commit -m "owner-web: messaging two-pane inbox + Ably realtime — Wave 05"
```

---

## Definition of Done

- [ ] `src/lib/api/messaging.ts` exposes `listThreads`, `getThread`, `send`, `markRead`, `createInquiry`, `ablyToken`
- [ ] `useAblyChannel(channelName, handler)` hook subscribes to an Ably channel using the backend-issued token, with a singleton client and clean teardown on unmount
- [ ] `MessageBubble` styles own messages with `forge-dim` background and renter messages with `surface` background; timestamps are mono and aligned to the bubble side
- [ ] Two-pane `/messages` layout: thread list on the left (≥1024px) and the open thread on the right
- [ ] Below 1024px the inbox swaps to a single-pane experience: list-only at `/messages`, thread-only at `/messages/{id}` with a back arrow
- [ ] Opening a thread auto-marks it read on the server **and** invalidates the inbox query so the unread badge clears
- [ ] Sending with **Enter** works; **Shift+Enter** inserts a newline
- [ ] Auto-scroll keeps the latest message in view
- [ ] Ably-pushed messages append without a refetch and don't duplicate (de-dupe by `id`)
- [ ] Channel name is configured (verify against backend Ably token claims — adjust the `thread-{id}` convention if needed)
- [ ] Listing-title header link routes to `/listings/{id}`; booking link routes to `/bookings/{id}`
- [ ] `npm run typecheck` passes
- [ ] Git commit `owner-web: messaging two-pane inbox + Ably realtime — Wave 05` is made
