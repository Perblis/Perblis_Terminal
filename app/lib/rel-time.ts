// Relative timestamp for conversation rows / message meta (ported from
// portal/lib): <1min "now" · <60min "N min ago" · same-day HH:MM · older "D Mon".
export function relTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.floor((now - then) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
