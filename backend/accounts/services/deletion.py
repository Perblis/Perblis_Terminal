"""Account deletion: soft-delete with the active-hire guard.

Soft delete starts a 30-day recovery window; the daily purge
(`accounts.tasks.purge_soft_deleted_accounts`) scrubs PII afterwards while
retaining verification/financial records. Deletion is blocked while the user
has a non-terminal hire — hires arrive in Wave 4, so the guard is a stable
error code that currently always passes.
"""

from __future__ import annotations

from accounts.errors import ActiveHireGuard
from accounts.models import User


def has_active_hires(user: User) -> bool:
    # Wave 4 wires this to the hires state machine (non-terminal statuses).
    # Until then there are no hires, so deletion is never blocked.
    return False


def soft_delete_account(*, user: User) -> None:
    if has_active_hires(user):
        raise ActiveHireGuard()
    # Bump token_version so existing sessions die immediately.
    user.token_version = user.token_version + 1
    user.save(update_fields=["token_version", "updated_at"])
    user.soft_delete()
