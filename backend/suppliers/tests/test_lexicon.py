"""Lexicon guard (design.md commandment 1): no owner/renter/booking in source.

Covers the Wave 2 supply code we own — the suppliers app and the cross-cutting
core media pipeline added alongside it.
"""

from __future__ import annotations

import re
from pathlib import Path

FORBIDDEN = re.compile(r"\b(owner|renter|booking)\b", re.IGNORECASE)

_BACKEND = Path(__file__).resolve().parents[2]
ROOTS = [_BACKEND / "suppliers", _BACKEND / "core"]


def _python_sources():
    for root in ROOTS:
        for path in root.rglob("*.py"):
            parts = set(path.parts)
            if "tests" in parts or "migrations" in parts or "__pycache__" in parts:
                continue
            yield path


def test_no_forbidden_lexicon_in_source():
    offenders = []
    for path in _python_sources():
        for i, line in enumerate(path.read_text().splitlines(), 1):
            if FORBIDDEN.search(line):
                offenders.append(f"{path}:{i}: {line.strip()}")
    assert not offenders, "Forbidden lexicon found:\n" + "\n".join(offenders)
