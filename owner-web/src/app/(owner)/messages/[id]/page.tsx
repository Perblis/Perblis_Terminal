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

  useEffect(() => {
    messagingApi.markRead(id).catch(() => undefined);
    qc.invalidateQueries({ queryKey: QUERY_KEYS.threads });
  }, [id, qc]);

  // Ably channel uses colon separator: thread:{id}
  useAblyChannel(`thread:${id}`, (msg) => {
    const payload = msg.data as Record<string, unknown>;
    if (!payload?.id) return;
    const incoming: Message = {
      id: payload.id as string,
      sender: {
        id: (payload.sender_id as string) ?? "",
        full_name: (payload.sender_name as string) ?? "",
        profile_photo: null,
      },
      body: (payload.body as string) ?? "",
      is_read: false,
      created_at: (payload.created_at as string) ?? new Date().toISOString(),
    };
    qc.setQueryData<typeof q.data>(QUERY_KEYS.thread(id), (prev) => {
      if (!prev) return prev;
      if (prev.messages.some((x) => x.id === incoming.id)) return prev;
      return { ...prev, messages: [...prev.messages, incoming] };
    });
  });

  const send = useMutation({
    mutationFn: () => messagingApi.send(id, draft.trim()),
    onSuccess: (res) => {
      const msg = res.data;
      qc.setQueryData<typeof q.data>(QUERY_KEYS.thread(id), (prev) => {
        if (!prev) return prev;
        if (prev.messages.some((x) => x.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
      setDraft("");
      qc.invalidateQueries({ queryKey: QUERY_KEYS.threads });
    },
  });

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
        <Avatar
          src={t.other_participant?.profile_photo ?? null}
          name={t.other_participant?.full_name ?? "?"}
          size={32}
        />
        <div className="min-w-0">
          <div className="font-body font-semibold text-[14px] truncate">
            {t.other_participant?.full_name ?? "Unknown"}
          </div>
          {t.listing_title ? (
            <Link
              href={t.listing_id ? `/listings/${t.listing_id}` : "#"}
              className="text-[11px] text-text-tertiary truncate hover:text-text-secondary block"
            >
              {t.listing_title}
            </Link>
          ) : null}
        </div>
        {t.booking_id ? (
          <Link href={`/bookings/${t.booking_id}`} className="ml-auto text-[12px] text-forge">
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
          placeholder="Type a message\u2026"
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
