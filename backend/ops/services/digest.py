"""Weekly founder digest (FSD §6.8 / TSD §9).

Assembles DB metrics (GMV, fees, hires-by-state, queue ages) plus best-effort
external usage — Ably stats (real 70% alert) and R2 storage. Pure assembly +
plain-text rendering; the task layer sends it.
"""

from __future__ import annotations

from typing import Any

from core import media, realtime
from ops.services import metrics


def build_digest() -> dict[str, Any]:
    return {
        "metrics": metrics.dashboard_metrics(),
        "queue_ages": metrics.queue_ages(),
        "ably": realtime.ably_usage(),  # None when keyless
        "r2": media.r2_usage(),  # None when unconfigured / on error
    }


def _age(hours: float | None) -> str:
    return "—" if hours is None else f"{hours:.0f}h"


def render_digest(digest: dict[str, Any]) -> tuple[str, str]:
    """Return ``(subject, body)`` for the founder email."""
    m = digest["metrics"]
    ages = digest["queue_ages"]
    ably = digest["ably"]
    r2 = digest["r2"]

    lines = [
        "Terminal — weekly digest",
        "",
        "Money",
        f"  GMV (collected):   {m['gmv_display']}",
        f"  Fees collected:    {m['fees_display']}",
        f"  Payout liability:  {m['payout_liability_display']}",
        f"  New users (7d):    {m['new_users_7d']}",
        "",
        "Hires by state",
    ]
    lines += [f"  {row['label']}: {row['count']}" for row in m["hires_by_state"]]
    lines += [
        "",
        "Queues (count · oldest)",
        f"  Verifications: {m['queues']['verifications']} · {_age(ages['verifications'])}",
        f"  Payouts due:   {m['queues']['payouts']} · {_age(ages['payouts'])}",
        f"  Reports open:  {m['queues']['reports']} · {_age(ages['reports'])}",
        f"  Disputes:      {m['queues']['disputes']} · {_age(ages['disputes'])}",
        "",
        "Usage",
    ]
    if ably is None:
        lines.append("  Ably: n/a (not configured)")
    else:
        flag = "  ⚠ ALERT" if ably["alert"] else ""
        lines.append(
            f"  Ably: {ably['pct']}% of free tier "
            f"(peak {ably['concurrent_peak']} conns, {ably['messages_month']} msgs){flag}"
        )
    lines.append(
        "  R2: n/a" if r2 is None else f"  R2: {r2['mb']} MB across {r2['objects']} objects"
    )

    recon = m["reconciliation"]
    lines += ["", "Reconciliation"]
    if recon is None:
        lines.append("  No run recorded yet.")
    else:
        state = "clean" if recon["is_clean"] else f"{recon['mismatch_count']} mismatch(es)"
        lines.append(f"  Last run {recon['run_at']:%Y-%m-%d %H:%M} — {state}.")

    subject = "Terminal weekly digest"
    if ably and ably["alert"]:
        subject += " — ⚠ Ably usage high"
    return subject, "\n".join(lines)
