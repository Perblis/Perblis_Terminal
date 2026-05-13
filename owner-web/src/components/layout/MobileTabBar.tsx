"use client";

import { Building2, CalendarDays, MessageSquare, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const tabs: Tab[] = [
  { href: "/listings", label: "Listings", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Profile", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-abyss fixed inset-x-0 bottom-0 z-30 flex h-14 border-t lg:hidden">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px]",
              active ? "text-forge" : "text-text-secondary",
            )}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden />
            <span className="tracking-[0.06em] uppercase">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
