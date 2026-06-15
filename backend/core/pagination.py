"""Cursor pagination — the default for all list endpoints (TSD §3.8).

Cursor (not offset) so large, frequently-mutated collections (search results,
hire lists) page consistently under concurrent writes.
"""

from __future__ import annotations

from rest_framework.pagination import CursorPagination


class TerminalCursorPagination(CursorPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = "-created_at"
