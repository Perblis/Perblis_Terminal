"""UUIDv7 generation.

Every domain row uses a UUIDv7 primary key (TSD §3.3): random-looking but
time-ordered, so primary-key indexes stay locality-friendly without leaking a
sequential count. Python's stdlib has no uuid7 yet, so we build one per
RFC 9562 §5.7: 48-bit Unix-ms timestamp, 4-bit version, 12 + 62 random bits.
"""

from __future__ import annotations

import os
import time
import uuid


def uuid7() -> uuid.UUID:
    """Return a time-ordered UUIDv7."""
    unix_ms = time.time_ns() // 1_000_000
    rand = int.from_bytes(os.urandom(10), "big")  # 80 random bits

    # Layout (128 bits):
    #   48 bits  unix_ms
    #    4 bits  version (0b0111)
    #   12 bits  rand_a
    #    2 bits  variant (0b10)
    #   62 bits  rand_b
    rand_a = rand >> 68 & 0x0FFF
    rand_b = rand & 0x3FFF_FFFF_FFFF_FFFF

    value = (unix_ms & 0xFFFF_FFFF_FFFF) << 80 | 0x7 << 76 | rand_a << 64 | 0b10 << 62 | rand_b
    return uuid.UUID(int=value)
