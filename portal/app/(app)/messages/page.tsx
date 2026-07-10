"use client";

// P9 · Messages. Two-pane: 06 §7 thread rows (filter all/enquiries/hires) +
// conversation pane with write-time-masked bodies (MaskedContact anatomy —
// 09 catalog copy, never shame copy). Optimistic send (grey → confirmed tick,
// the ONE optimistic surface besides read-states, 07 §2); 15s polling is the
// spec'd keyless fallback — Ably fan-out arrives with 7E, indistinguishable
// beyond latency (F7). Keyboard: ↑↓ threads, Enter → composer.
import { Check, Lock, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/shell/page-header";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { bff } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/queries";
import { useRealtimeChannel } from "@/lib/realtime";
import type { Conversation, Message, Paginated } from "@/lib/types";

type Filter = "all" | "enquiry" | "hire";

function relTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = (Date.now() - d.getTime()) / 60_000;
  if (mins < 60) return `${Math.max(1, Math.floor(mins))} min ago`;
  if (mins < 24 * 60) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function MessagesPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingBodies, setPendingBodies] = useState<{ key: string; body: string }[]>([]);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => bff<Paginated<Conversation> & { unread_total: number }>("/conversations"),
    refetchInterval: 15_000,
  });

  const threads = useMemo(() => {
    let list = conversations.data?.results ?? [];
    if (filter !== "all") list = list.filter((c) => c.kind === filter);
    return list;
  }, [conversations.data, filter]);

  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [threads, activeId]);

  const active = threads.find((c) => c.id === activeId) ?? null;

  // Live fan-out on the open thread; 15s polling stays as the safety net.
  useRealtimeChannel(activeId ? `conv:${activeId}` : null, () => {
    void qc.invalidateQueries({ queryKey: ["messages", activeId] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
  });

  const messages = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => bff<Paginated<Message>>(`/conversations/${activeId}/messages`),
    enabled: Boolean(activeId),
    refetchInterval: 15_000,
    select: (d) => [...d.results].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()),
  });

  // Mark read on open / on new messages.
  useEffect(() => {
    if (!activeId || !messages.data) return;
    const unreadIds = messages.data.filter((m) => m.sender_id !== me.data?.id && !m.read_at).map((m) => m.id);
    if (unreadIds.length > 0) {
      void bff("/messages/read", { method: "POST", body: JSON.stringify({ message_ids: unreadIds }) }).then(() => {
        void qc.invalidateQueries({ queryKey: ["conversations"] });
        void qc.invalidateQueries({ queryKey: ["unread-total"] });
      });
    }
  }, [activeId, messages.data, me.data?.id, qc]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.data?.length, pendingBodies.length, activeId]);

  const send = useMutation({
    mutationFn: (body: string) =>
      bff<Message>(`/conversations/${activeId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    onMutate: (body) => {
      const key = `${Date.now()}`;
      setPendingBodies((p) => [...p, { key, body }]);
      return { key };
    },
    onSettled: (_data, error, _body, ctx) => {
      if (ctx) setPendingBodies((p) => p.filter((x) => x.key !== ctx.key));
      if (!error) {
        void qc.invalidateQueries({ queryKey: ["messages", activeId] });
        void qc.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
  });

  function submitDraft() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft("");
    send.mutate(body);
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    const idx = threads.findIndex((t) => t.id === activeId);
    if (e.key === "ArrowDown" && idx < threads.length - 1) {
      setActiveId(threads[idx + 1].id);
      e.preventDefault();
    }
    if (e.key === "ArrowUp" && idx > 0) {
      setActiveId(threads[idx - 1].id);
      e.preventDefault();
    }
    if (e.key === "Enter") {
      composer.current?.focus();
      e.preventDefault();
    }
  }

  const firstMaskedId = messages.data?.find((m) => m.masked)?.id;

  return (
    <>
      <PageHeader title="Messages" />
      <Card className="grid h-[calc(100vh-14rem)] min-h-96 grid-cols-1 overflow-hidden p-0 md:grid-cols-[minmax(16rem,22rem)_1fr]">
        {/* thread list */}
        <div className="flex min-h-0 flex-col border-r border-border-default">
          <div className="flex gap-s1 border-b border-border-default p-s2">
            {(["all", "enquiry", "hire"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "rounded-pill px-s3 py-s1 text-caption font-medium",
                  filter === f ? "bg-ink-900 text-paper-0" : "text-text-secondary hover:bg-ink-100",
                )}
              >
                {f === "all" ? "All" : f === "enquiry" ? "Enquiries" : "Hires"}
              </button>
            ))}
          </div>
          <div role="listbox" aria-label="Conversations" tabIndex={0} onKeyDown={onListKeyDown} className="min-h-0 flex-1 overflow-y-auto outline-none">
            {conversations.isPending ? (
              <div className="flex flex-col gap-s2 p-s3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-s7 w-full" />)}
              </div>
            ) : threads.length === 0 ? (
              <p className="p-s4 text-body-sm text-text-secondary">No conversations — enquiries from hirers land here.</p>
            ) : (
              threads.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full items-start gap-s2 border-b border-border-default px-s3 py-s2 text-left hover:bg-ink-50",
                    c.id === activeId && "bg-ink-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-s1 text-body-sm font-medium text-text-primary">
                      <span className="truncate">{c.counterparty.name}</span>
                      {c.counterparty.verified ? <Check size={12} className="shrink-0 text-blue-600" aria-label="Verified" /> : null}
                    </p>
                    <p className="truncate text-caption text-ink-500">
                      {c.listing ? c.listing.title : "General enquiry"}
                    </p>
                    <p className="truncate text-caption text-text-secondary">{c.last_message_preview}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-s1">
                    <span className="font-mono text-mono-sm text-ink-500">{relTime(c.last_message_at)}</span>
                    {c.unread_count > 0 ? (
                      <span className="rounded-pill bg-amber-500 px-s2 text-caption font-semibold text-ink-900">{c.unread_count}</span>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* conversation pane */}
        <div className="flex min-h-0 flex-col">
          {!active ? (
            <div className="grid flex-1 place-items-center text-body-sm text-text-secondary">Pick a conversation</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border-default px-s4 py-s2">
                <div>
                  <p className="text-body-sm font-medium text-text-primary">{active.counterparty.name}</p>
                  <p className="text-caption text-ink-500">
                    {active.kind === "hire" ? "Hire conversation" : active.listing ? `Enquiry · ${active.listing.title}` : "General enquiry"}
                    {active.yard_name ? ` · ${active.yard_name}` : ""}
                  </p>
                </div>
              </div>
              <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-s4">
                {messages.isPending ? (
                  <div className="flex flex-col gap-s2">
                    {[0, 1].map((i) => <Skeleton key={i} className="h-s6 w-2/3" />)}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-s2">
                    {(messages.data ?? []).map((m) => {
                      const mine = m.sender_id === me.data?.id;
                      return (
                        <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                          {m.id === firstMaskedId ? (
                            <Banner tone="info" className="mb-s2 w-full">
                              Numbers unlock after payment — Terminal protects both parties.
                            </Banner>
                          ) : null}
                          <div
                            className={cn(
                              "max-w-[75%] rounded-md border px-s3 py-s2 text-body",
                              mine ? "border-border-default bg-surface-card" : "border-transparent bg-ink-100",
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            {m.masked ? (
                              <p className="mt-s1 flex items-center gap-s1 rounded-pill bg-amber-100 px-s2 py-px text-caption text-amber-900">
                                <Lock size={11} aria-hidden /> contact hidden until paid
                              </p>
                            ) : null}
                          </div>
                          <p className="mt-px flex items-center gap-s1 font-mono text-mono-sm text-ink-500">
                            {new Date(m.sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            {mine ? <Check size={11} aria-label="Sent" /> : null}
                          </p>
                        </li>
                      );
                    })}
                    {pendingBodies.map((p) => (
                      <li key={p.key} className="flex flex-col items-end">
                        <div className="max-w-[75%] rounded-md border border-border-default bg-surface-card px-s3 py-s2 text-body opacity-60">
                          <p className="whitespace-pre-wrap break-words">{p.body}</p>
                        </div>
                        <p className="mt-px font-mono text-mono-sm text-ink-500">
                          <Check size={11} className="inline text-ink-300" aria-label="Sending" />
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {send.isError ? (
                  <p className="mt-s2 text-body-sm text-text-danger">
                    Message didn&apos;t send.{" "}
                    <button type="button" className="underline" onClick={() => send.mutate(send.variables as string)}>
                      Retry
                    </button>
                  </p>
                ) : null}
              </div>
              <div className="flex items-end gap-s2 border-t border-border-default p-s3">
                <textarea
                  ref={composer}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitDraft();
                    }
                  }}
                  placeholder="Write a message…"
                  className="max-h-32 min-h-12 flex-1 resize-y rounded-sm border border-border-default p-s3 text-body outline-none placeholder:text-ink-500"
                />
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={!draft.trim()}
                  aria-label="Send message"
                  className="grid size-12 shrink-0 place-items-center rounded-sm bg-action-primary text-text-on-brand disabled:bg-ink-100 disabled:text-ink-400"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </Card>
    </>
  );
}
