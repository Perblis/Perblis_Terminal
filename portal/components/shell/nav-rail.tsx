"use client";

import {
  Boxes,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Rows2,
  Rows4,
  Settings,
  Store,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

import { WordmarkPlate } from "@/components/brand/wordmark";
import { CountBadge } from "@/components/ui/status-badge";
import { auth } from "@/lib/api";
import { cn } from "@/lib/cn";

import { applyDensity, persistRailCollapsed, readDensity, readRailCollapsed, type Density } from "./preferences";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/hires", label: "Hires", icon: Truck },
  { href: "/hires/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/storefront", label: "Storefront", icon: Store },
];

function RailIconButton({
  label,
  onClick,
  collapsed,
  children,
}: {
  label: string;
  onClick: () => void;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 items-center gap-s2 rounded-sm px-s2 text-ink-400",
        "transition-colors duration-quick hover:bg-ink-800 hover:text-text-inverse",
        collapsed ? "w-9 justify-center" : "w-full",
      )}
    >
      {children}
      {collapsed ? null : <span className="text-caption">{label}</span>}
    </button>
  );
}

/** Portal nav rail (05 §5): ink-900, 240px ↔ 64px, active = amber left bar. */
export function NavRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setCollapsed(readRailCollapsed() || window.innerWidth < 768);
    setDensity(readDensity());
  }, []);

  const isActive = (href: string) =>
    href === "/hires"
      ? pathname === "/hires" || (pathname.startsWith("/hires/") && !pathname.startsWith("/hires/calendar"))
      : pathname === href || pathname.startsWith(`${href}/`);

  async function logout() {
    setSigningOut(true);
    try {
      await auth("/logout");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const nextDensity: Density = density === "comfortable" ? "compact" : "comfortable";

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
      <div className={cn("flex items-center justify-between px-s3 py-s4", collapsed && "flex-col gap-s2 px-0")}>
        <Link href="/dashboard" aria-label="Terminal dashboard">
          <WordmarkPlate compact={collapsed} />
        </Link>
        <button
          type="button"
          onClick={() => {
            persistRailCollapsed(!collapsed);
            setCollapsed(!collapsed);
          }}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="rounded-sm p-s1 text-ink-400 hover:bg-ink-800 hover:text-text-inverse"
        >
          {collapsed ? <PanelLeftOpen size={16} aria-hidden /> : <PanelLeftClose size={16} aria-hidden />}
        </button>
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
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex h-10 items-center gap-s3 rounded-sm px-s3 text-body-sm font-medium",
            "transition-colors duration-quick",
            pathname.startsWith("/settings")
              ? "text-text-inverse"
              : "text-ink-300 hover:bg-ink-800 hover:text-text-inverse",
            collapsed && "justify-center px-0",
          )}
        >
          <Settings size={18} aria-hidden />
          {collapsed ? null : <span>Settings</span>}
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={signingOut}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex h-10 items-center gap-s3 rounded-sm px-s3 text-body-sm font-medium text-ink-300",
            "transition-colors duration-quick hover:bg-ink-800 hover:text-text-inverse",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut size={18} aria-hidden />
          {collapsed ? null : <span>{signingOut ? "Signing out…" : "Sign out"}</span>}
        </button>
        <div className={cn("flex gap-s1 pt-s1", collapsed ? "flex-col items-center" : "")}>
          <RailIconButton
            label={density === "comfortable" ? "Compact rows" : "Comfortable rows"}
            collapsed={collapsed}
            onClick={() => {
              applyDensity(nextDensity);
              setDensity(nextDensity);
            }}
          >
            {density === "comfortable" ? <Rows2 size={16} aria-hidden /> : <Rows4 size={16} aria-hidden />}
          </RailIconButton>
        </div>
      </div>
    </nav>
  );
}
