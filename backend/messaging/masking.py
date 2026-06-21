"""Contact masking (TSD §3.10) — server-side, applied at write time.

Nigerian phone numbers and email addresses are redacted so contact details
can't be exchanged before a hire is paid. Masking runs once on create: the
original ``body`` is retained (Ops/dispute visibility) and ``mask(body)`` is
stored as ``body_masked``. Whether a reader is served ``body`` or ``body_masked``
is decided later from the hire's status — see ``messaging.services``.

Deliberate posture (TSD §3.10): regex only, no keyword surveillance. The phone
pattern follows TSD's ``(\\+?234|0)[789][01]\\d{8}`` and additionally tolerates
spaced / dotted / dashed grouping. Boundary lookarounds keep it from biting a
phone-shaped slice out of a longer pure-digit run (prices, RC numbers).
"""

from __future__ import annotations

import re

# NG mobile: 0 (or +234 / 234) then [789][01] then eight more digits, with an
# optional single separator (space, dot, dash) between groups. (?<!\d)/(?!\d)
# ensure we match a whole number, not a substring of a longer digit run.
PHONE_RE = re.compile(r"(?<!\d)(?:\+?234|0)[\s.\-]?[789][\s.\-]?[01](?:[\s.\-]?\d){8}(?!\d)")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

_REDACTION = "•••"


def mask(body: str) -> str:
    """Return ``body`` with phone numbers and emails replaced by a redaction
    token. Emails first, then phones (emails may contain digit-like locals)."""
    masked = EMAIL_RE.sub(_REDACTION, body)
    masked = PHONE_RE.sub(_REDACTION, masked)
    return masked


def contains_contact(body: str) -> bool:
    """True if ``body`` carries a phone number or email (i.e. masking changed it)."""
    return bool(PHONE_RE.search(body) or EMAIL_RE.search(body))
