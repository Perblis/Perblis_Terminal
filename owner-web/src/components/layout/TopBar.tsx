"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bell, ChevronDown } from "lucide-react";

import { Avatar } from "@/components/tds/Avatar";
import { useLogout, useMe } from "@/hooks/useAuth";

export function TopBar() {
  const me = useMe();
  const logout = useLogout();
  const user = me.data;
  const displayName = user?.full_name || user?.email || "";

  return (
    <header className="border-border bg-abyss/95 sticky top-0 z-20 flex h-14 items-center justify-between border-b px-5">
      {/* Page-level title slot is owned by <PageHeader />; keep the top bar minimal */}
      <div aria-hidden />

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="border-border bg-surface text-text-secondary hover:text-text-primary relative grid h-10 w-10 place-items-center rounded-full border"
          aria-label="Notifications"
        >
          <Bell size={18} strokeWidth={1.5} aria-hidden />
          <span
            aria-hidden
            className="bg-forge border-surface absolute top-2 right-2 h-2 w-2 rounded-full border-2"
          />
        </button>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button
              type="button"
              className="hover:bg-surface-high text-text-primary flex h-10 items-center gap-2 rounded px-2"
              aria-label="Account menu"
            >
              <Avatar src={null} name={displayName || "?"} size={28} />
              <span className="hidden text-[13px] sm:block">{displayName}</span>
              <ChevronDown size={14} strokeWidth={1.5} className="text-text-tertiary" aria-hidden />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              align="end"
              sideOffset={6}
              className="rounded-card border-border bg-surface-elevated min-w-[180px] border p-1 shadow-none"
            >
              <Dropdown.Item asChild>
                <a
                  href="/settings"
                  className="text-text-primary hover:bg-surface-high block h-9 cursor-pointer rounded px-3 text-[13px] leading-9 outline-none"
                >
                  Settings
                </a>
              </Dropdown.Item>
              <Dropdown.Separator className="bg-border my-1 h-px" />
              <Dropdown.Item
                onSelect={() => logout.mutate()}
                className="text-alert-soft hover:bg-surface-high h-9 cursor-pointer rounded px-3 text-[13px] leading-9 outline-none"
              >
                Sign out
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}
