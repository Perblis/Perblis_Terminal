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
                    <Avatar
                      src={t.other_participant?.profile_photo ?? null}
                      name={t.other_participant?.full_name ?? "?"}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body font-semibold text-[14px] truncate">
                          {t.other_participant?.full_name ?? "Unknown"}
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
                          {t.last_message?.body ?? "\u2014"}
                        </p>
                        {t.unread_count > 0 ? <Badge tone="accent">{t.unread_count}</Badge> : null}
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
