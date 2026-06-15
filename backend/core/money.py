"""Money helpers — integer kobo, always.

Commandment 2: money is integer kobo everywhere in domain logic. No floats,
no Decimals, never store naira. The UI shows whole naira; this module is the
only place that converts between the two and the only place that formats money
for display.

100 kobo = ₦1.
"""

from __future__ import annotations

KOBO_PER_NAIRA = 100


def kobo(naira_amount: int) -> int:
    """Convert a whole-naira integer to integer kobo.

    Rejects floats outright — passing 19.99 here is a bug, not a rounding
    question. Booleans are ints in Python but are never valid money.
    """
    if isinstance(naira_amount, bool) or not isinstance(naira_amount, int):
        raise TypeError(f"naira must be an int, got {type(naira_amount).__name__}")
    return naira_amount * KOBO_PER_NAIRA


def naira(kobo_amount: int) -> int:
    """Convert integer kobo to whole naira (floor).

    Kobo must divide evenly into naira for any amount we display; callers that
    need sub-naira precision are doing something wrong in this domain.
    """
    if isinstance(kobo_amount, bool) or not isinstance(kobo_amount, int):
        raise TypeError(f"kobo must be an int, got {type(kobo_amount).__name__}")
    return kobo_amount // KOBO_PER_NAIRA


def display(kobo_amount: int) -> str:
    """Format integer kobo as a naira string, e.g. display(125000000) -> '₦1,250,000'."""
    if isinstance(kobo_amount, bool) or not isinstance(kobo_amount, int):
        raise TypeError(f"kobo must be an int, got {type(kobo_amount).__name__}")
    return f"₦{naira(kobo_amount):,}"
