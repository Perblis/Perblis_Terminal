"use client";

import {
  Boxes,
  CalendarDays,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

import { WordmarkPlate } from "@/components/brand/wordmark";
import { CountBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";

import { DensityToggle } from "./density-toggle";
import { persistRailCollapsed, readRailCollapsed } from "./preferences";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  /** Slot for live counts (Messages unread, Hires action-needed) — wired in 7B/7D. */
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/hires", label: "Hires", icon: Truck },
  { href: "/hires/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/storefront", label: "Storefront", icon: Store },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Portal nav rail (05 §5): ink-900, 240px ↔ 64px, active = amber left bar. */
export function NavRail() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Phones start icon-only regardless of the remembered preference (04 §2).
  useEffect(() => setCollapsed(readRailCollapsed() || window.innerWidth < 768), []);

  const isActive = (href: string) =>
    href === "/hires"
      ? pathname === "/hires" || (pathname.startsWith("/hires/") && !pathname.startsWith("/hires/calendar"))
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Primary"
      data-collapsed={collapsed || undefined}
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-surface-inverse",
        "transition-[width] duration-standard ease-in-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center px-s3 py-s4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" aria-label="Terminal dashboard">
          <WordmarkPlate compact={collapsed} />
        </Link>
      </div>

      <ul className="flex flex-1 flex-col gap-s1 px-s2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          return (
            <li key={href} className="relative">
              {active ? (
                <span aria-hidden className="absolute -left-s2 top-1/2 h-s5 w-[3px] -translate-y-1/2 bg-amber-500" />
              ) : null}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex h-10 items-center gap-s3 rounded-sm px-s3 text-body-sm font-medium",
                  "transition-colors duration-quick",
                  active ? "text-text-inverse" : "text-ink-300 hover:bg-ink-800 hover:text-text-inverse",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className="relative">
                  <Icon size={18} aria-hidden />
                  {collapsed && badge ? (
                    <CountBadge count={badge} className="absolute -right-s2 -top-s1 scale-90" />
                  ) : null}
                </span>
                {collapsed ? null : (
                  <>
                    <span className="flex-1">{label}</span>
                    {badge ? <CountBadge count={badge} /> : null}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-s1 border-t border-ink-800 p-s2">
        <DensityToggle collapsed={collapsed} />
        <button
          type="button"
          onClick={() => {
            persistRailCollapsed(!collapsed);
            setCollapsed(!collapsed);
          }}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={cn(
            "flex h-10 w-full items-center gap-s3 rounded-sm px-s3 text-body-sm text-ink-300",
            "transition-colors duration-quick hover:bg-ink-800 hover:text-text-inverse",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
          {collapsed ? null : <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
