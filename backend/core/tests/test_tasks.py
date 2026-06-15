"""Heartbeat task proves the django-tasks round-trip.

Under test settings the immediate backend runs the task synchronously on
enqueue; the compose-backed CI/integration run exercises the real DB broker
with `manage.py db_worker`.
"""

from __future__ import annotations

import pytest

from core.tasks import heartbeat


def test_heartbeat_callable_directly():
    assert heartbeat.func("pong") == "heartbeat:pong"


@pytest.mark.django_db
def test_heartbeat_enqueue_executes():
    result = heartbeat.enqueue("ci")
    # Immediate backend finishes synchronously.
    assert result.return_value == "heartbeat:ci"
