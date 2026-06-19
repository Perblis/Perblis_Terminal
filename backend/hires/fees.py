"""The fee engine — pure money, integer kobo (FSD §3.1, TSD §3.2).

The single source of truth for what a hire costs, what Terminal earns, and what
the supplier receives. Everything here is a pure function of (asset class,
prices, duration): no I/O, no ORM, no clock. Downstream the result is computed
at request time for the hirer preview and **locked at acceptance** — never
recomputed against a later rate table (FSD §3.1 rule 5).

Money is integer kobo throughout (Commandment 2). Rates are stored as integer
**per-mille** (‰) so the arithmetic never touches a float or Decimal:
``service_fee = value × rate // 1000``.

Binding rules implemented here:
- Best-price (D-008): hire_value = min over only the schemes the supplier set,
  ties resolve to the longer scheme (the lower rate).
- Fee floor (D-002): service_fee = max(rate × value, ₦2,500). No flat override.
- Supplier pays (D-005): hirer pays hire_value exactly; payout = value − fee.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from listings.enums import AssetClass

from .enums import Scheme

# ₦2,500 floor on every service fee (D-002), expressed in kobo.
FEE_FLOOR = 250_000

# String codes for the schemes (== the enum values at runtime; ``str`` to the
# type checker, which has no django-stubs to see TextChoices members as strings).
_DAILY, _WEEKLY, _MONTHLY = str(Scheme.DAILY), str(Scheme.WEEKLY), str(Scheme.MONTHLY)

# Service-fee rates in integer per-mille (‰) by asset class and winning scheme
# (FSD §3.1 table). 120‰ == 12%. Kept as ‰ so fee math stays pure integer.
RATE_TABLE: dict[str, dict[str, int]] = {
    str(AssetClass.PLANT_MACHINERY): {_DAILY: 120, _WEEKLY: 100, _MONTHLY: 80},
    str(AssetClass.TRUCKS_HAULAGE): {_DAILY: 110, _WEEKLY: 90, _MONTHLY: 70},
    str(AssetClass.WAREHOUSING): {_DAILY: 100, _WEEKLY: 80, _MONTHLY: 60},
    str(AssetClass.TERMINALS_YARDS): {_DAILY: 100, _WEEKLY: 80, _MONTHLY: 60},
    str(AssetClass.LAND_STAGING): {_DAILY: 100, _WEEKLY: 80, _MONTHLY: 60},
}

# How many days one unit of each scheme bills; also the tie-break rank (longer
# scheme wins a tie — FSD §3.1 rule 1).
_SCHEME_DAYS = {_DAILY: 1, _WEEKLY: 7, _MONTHLY: 30}


@dataclass(frozen=True)
class FeeQuote:
    """The locked-at-acceptance financial shape of a hire. All money in kobo."""

    hire_value: int
    service_fee: int
    payout_amount: int
    fee_basis: str
    scheme: str


def duration_days(start: dt.date, end: dt.date) -> int:
    """Inclusive hire length: d = end − start + 1 (FSD §3.1)."""
    d = (end - start).days + 1
    if d < 1:
        raise ValueError("end_date must be on or after start_date")
    return d


def _ceil_div(a: int, b: int) -> int:
    return -(-a // b)


def quote(
    asset_class: str,
    *,
    days: int,
    daily_price: int | None,
    weekly_price: int | None = None,
    monthly_price: int | None = None,
) -> FeeQuote:
    """Compute the locked financials for a hire of ``days`` days.

    Prices are integer kobo; any scheme the supplier hasn't set is ``None`` and
    excluded from the best-price comparison. ``daily_price`` is always set on a
    Live listing (publish gate), so at least one candidate always exists.
    """
    if days < 1:
        raise ValueError("days must be >= 1")
    rates = RATE_TABLE.get(asset_class)
    if rates is None:
        raise ValueError(f"unknown asset_class: {asset_class!r}")

    prices = {
        _DAILY: daily_price,
        _WEEKLY: weekly_price,
        _MONTHLY: monthly_price,
    }
    # One candidate (total, scheme) per scheme the supplier has priced.
    candidates: list[tuple[int, str]] = []
    for scheme, price in prices.items():
        if price is None:
            continue
        units = _ceil_div(days, _SCHEME_DAYS[scheme])
        candidates.append((price * units, scheme))
    if not candidates:
        raise ValueError("at least one pricing scheme must be set")

    # Best price wins; ties resolve to the longer scheme (larger unit, lower rate).
    hire_value, scheme = min(candidates, key=lambda c: (c[0], -_SCHEME_DAYS[c[1]]))

    rate = rates[scheme]
    service_fee = max(hire_value * rate // 1000, FEE_FLOOR)
    payout_amount = hire_value - service_fee
    # ``scheme`` is already the lowercase code word ("daily"/"weekly"/"monthly").
    fee_basis = f"{rate // 10}% {scheme} (min ₦2,500)"

    return FeeQuote(
        hire_value=hire_value,
        service_fee=service_fee,
        payout_amount=payout_amount,
        fee_basis=fee_basis,
        scheme=scheme,
    )
