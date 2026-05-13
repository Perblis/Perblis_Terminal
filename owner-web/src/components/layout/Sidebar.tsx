"use client";

import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", label: "Listings", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-abyss hidden w-[224px] shrink-0 flex-col gap-1 border-r px-3 py-5 lg:flex">
      <div className="px-2 pb-4">
        <div className="font-display text-[22px] leading-none tracking-tight uppercase">
          Terminal
        </div>
        <div className="font-body text-text-tertiary mt-1 text-[11px] tracking-[0.06em] uppercase">
          Owner
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "font-body duration-fast flex h-10 items-center gap-3 rounded px-3 text-[14px] transition-colors",
                active
                  ? "bg-forge-dim text-forge-light"
                  : "text-text-secondary hover:bg-surface-high hover:text-text-primary",
              )}
            >
              <Icon size={18} strokeWidth={1.5} aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
