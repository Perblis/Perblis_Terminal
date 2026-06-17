"""The `deploy` management command serializes deploy-time DB work.

Both the web and worker Railway services run their migrations on deploy; the
command must take a Postgres advisory lock first so the two `migrate`
processes can't race (the loser would die on a duplicate `CREATE TABLE`).
These tests mock the DB cursor and `call_command` so they need no live DB:
they assert the lock is taken before any work, that migrate runs before the
superuser seed, and that the lock is always released — even when a step
raises.
"""

from __future__ import annotations

from unittest import mock

import pytest

from core.management.commands.deploy import _ADVISORY_LOCK_KEY, Command


def _run(call_command_side_effect=None):
    """Run the command with the cursor + call_command patched, returning the
    ordered list of (kind, payload) events for assertions."""
    events: list[tuple] = []

    cursor = mock.MagicMock()
    cursor.execute.side_effect = lambda sql, params=None: events.append(("sql", sql, params))

    cursor_cm = mock.MagicMock()
    cursor_cm.__enter__.return_value = cursor

    def fake_call_command(name, *args, **kwargs):
        events.append(("call", name))
        if call_command_side_effect is not None:
            call_command_side_effect(name)

    with (
        mock.patch("core.management.commands.deploy.connection") as conn,
        mock.patch("core.management.commands.deploy.call_command", side_effect=fake_call_command),
    ):
        conn.cursor.return_value = cursor_cm
        Command().handle(interactive=False, verbosity=1)
    return events


def test_lock_taken_before_work_then_released():
    events = _run()

    # First action is acquiring the advisory lock.
    assert events[0][0] == "sql" and "pg_advisory_lock" in events[0][1]
    assert events[0][2] == [_ADVISORY_LOCK_KEY]
    # Last action is releasing it.
    assert events[-1][0] == "sql" and "pg_advisory_unlock" in events[-1][1]
    assert events[-1][2] == [_ADVISORY_LOCK_KEY]

    # migrate runs before seed_superuser, both inside the lock.
    calls = [e[1] for e in events if e[0] == "call"]
    assert calls == ["migrate", "seed_superuser"]


def test_lock_released_even_when_migrate_fails():
    def boom(name):
        if name == "migrate":
            raise RuntimeError("migrate exploded")

    with pytest.raises(RuntimeError, match="migrate exploded"):
        _run(call_command_side_effect=boom)


def test_lock_released_on_failure_runs_unlock():
    """The unlock SQL must still fire when a step raises."""
    released = {"ok": False}

    cursor = mock.MagicMock()

    def execute(sql, params=None):
        if "pg_advisory_unlock" in sql:
            released["ok"] = True

    cursor.execute.side_effect = execute
    cursor_cm = mock.MagicMock()
    cursor_cm.__enter__.return_value = cursor

    def fake_call_command(name, *args, **kwargs):
        raise RuntimeError("boom")

    with (
        mock.patch("core.management.commands.deploy.connection") as conn,
        mock.patch("core.management.commands.deploy.call_command", side_effect=fake_call_command),
    ):
        conn.cursor.return_value = cursor_cm
        with pytest.raises(RuntimeError):
            Command().handle(interactive=False, verbosity=1)

    assert released["ok"], "advisory lock was not released on failure"
