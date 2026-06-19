"""Keyset cursor pagination for the computed search-list results (TSD §3.8).

The list endpoint's results are assembled and ordered in Python (heterogeneous
yard cards + listings in ``location`` mode; flat listings in ``asset`` mode),
so DRF's queryset ``CursorPagination`` doesn't fit. This is a true **keyset**
cursor over ``(distance_km, tiebreak_id)``: page boundaries are *values*, not
offsets, so inserts never shift, duplicate or skip rows across pages (the
mandatory "stability under inserts" check).

The envelope mirrors DRF's pager — ``{"results", "next", "previous"}`` with
opaque ``?cursor=`` links — so clients page it like any other list.
"""

from __future__ import annotations

import base64
from urllib.parse import urlencode

# Each item carries an internal sort key ``_key = (distance_km, tiebreak_id)``.
SortKey = tuple[float, str]

PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def _encode(direction: str, key: SortKey) -> str:
    raw = f"{direction}|{key[0]:.4f}|{key[1]}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode(cursor: str) -> tuple[str, SortKey]:
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    direction, distance, tiebreak = raw.split("|", 2)
    return direction, (float(distance), tiebreak)


def _link(request, cursor: str | None) -> str | None:
    if cursor is None:
        return None
    query = request.query_params.copy()
    query["cursor"] = cursor
    return request.build_absolute_uri(f"{request.path}?{urlencode(query, doseq=True)}")


def page_size_from(request) -> int:
    raw = request.query_params.get("page_size")
    if not raw:
        return PAGE_SIZE
    try:
        size = int(raw)
    except ValueError:
        return PAGE_SIZE
    return max(1, min(size, MAX_PAGE_SIZE))


def paginate(items: list[dict], request) -> dict:
    """Slice an ordered ``items`` list (each with ``_key``) into a cursor page.

    ``items`` must already be sorted ascending by ``_key``. Returns the DRF-style
    envelope; ``_key`` is stripped from the emitted results.
    """
    size = page_size_from(request)
    cursor = request.query_params.get("cursor")

    if cursor:
        direction, key = _decode(cursor)
    else:
        direction, key = "f", None

    if direction == "b" and key is not None:
        before = [i for i in items if i["_key"] < key]
        window = before[-size:]
        has_more_back = len(before) > size
        prev_cursor = _encode("b", window[0]["_key"]) if window and has_more_back else None
        next_cursor = _encode("f", window[-1]["_key"]) if window else None
    else:
        after = [i for i in items if key is None or i["_key"] > key] if items else []
        window = after[:size]
        has_more_fwd = len(after) > size
        next_cursor = _encode("f", window[-1]["_key"]) if window and has_more_fwd else None
        # A previous link exists whenever we're past the first item.
        prev_cursor = _encode("b", window[0]["_key"]) if window and (key is not None) else None

    results = [{k: v for k, v in item.items() if k != "_key"} for item in window]
    return {
        "results": results,
        "next": _link(request, next_cursor),
        "previous": _link(request, prev_cursor),
    }
