#!/usr/bin/env python
"""Fail if settings read an env var that `.env.example` doesn't document.

Wave 0 CI gate: `.env.example` must stay exhaustive (design.md §6). We scan the
settings package for `env("VAR")` / `env.int("VAR")` / `env.db_url("VAR")`
style reads and assert every referenced name appears in `.env.example`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
SETTINGS_DIR = BACKEND_DIR / "settings"
ENV_EXAMPLE = BACKEND_DIR / ".env.example"

# Matches env("NAME"), env.int('NAME'), env.db_url("NAME"), env.bool(...), etc.
ENV_CALL = re.compile(r"\benv(?:\.\w+)?\(\s*[\"']([A-Z][A-Z0-9_]*)[\"']")


def referenced_vars() -> set[str]:
    names: set[str] = set()
    for path in SETTINGS_DIR.glob("*.py"):
        names.update(ENV_CALL.findall(path.read_text()))
    return names


def documented_vars() -> set[str]:
    names: set[str] = set()
    for raw in ENV_EXAMPLE.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        names.add(line.split("=", 1)[0].strip())
    return names


def main() -> int:
    missing = sorted(referenced_vars() - documented_vars())
    if missing:
        print("ERROR: settings read env vars absent from .env.example:")
        for name in missing:
            print(f"  - {name}")
        print("Add them (with a dummy value) to backend/.env.example.")
        return 1
    print("OK: .env.example documents every env var the settings read.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
