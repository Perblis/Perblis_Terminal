import Link from "next/link";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { StatusDot } from "./StatusDot";
import { formatDateRange, formatNaira, formatRelativeTime } from "@/lib/format";
import type { Booking } from "@/lib/api/bookings";

const accentMap = {
  pending: "amber",
  confirmed: "signal",
  active: "forge",
  declined: "alert",
  cancelled: "alert",
  completed: null,
} as const;

export function BookingRow({ booking, href }: { booking: Booking; href?: string }) {
  const accent = accentMap[booking.status] ?? null;
  const renterName = booking.renter.full_name;
  const inner = (
    <Card accent={accent} className="hover:bg-surface-high transition-colors duration-fast">
      <div className="flex items-start gap-3">
        <Avatar src={booking.renter.profile_photo} name={renterName} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-body font-semibold text-[14px] truncate">
              {renterName}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-secondary">
              <StatusDot status={booking.status} /> {booking.status}
            </span>
          </div>
          <div className="text-[13px] text-text-secondary truncate">{booking.listing_title}</div>
          <div className="flex items-baseline justify-between mt-1 font-mono text-[12px]">
            <span className="text-text-tertiary">
              {formatDateRange(booking.start_date, booking.end_date)}
            </span>
            <span className="text-forge-light">{formatNaira(booking.gross_amount)}</span>
          </div>
          <div className="font-mono text-[11px] text-text-tertiary mt-1">
            {formatRelativeTime(booking.created_at)}
          </div>
        </div>
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
