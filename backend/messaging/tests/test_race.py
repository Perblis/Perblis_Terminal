"""Unread counters are correct under concurrent send + read (FSD §8 acceptance)."""

from __future__ import annotations

import threading

import pytest
from django.db import connection

from accounts.factories import UserFactory
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from messaging.factories import ConversationFactory
from messaging.services import mark_read, send_message, unread_count


@pytest.mark.django_db(transaction=True)
def test_concurrent_sends_then_read_yield_consistent_unread():
    listing = ListingFactory(status=ListingStatus.LIVE)
    hirer = UserFactory()
    conv = ConversationFactory(listing=listing, supplier=listing.supplier, hirer=hirer)
    supplier = listing.supplier
    barrier = threading.Barrier(3)

    def _send(body):
        barrier.wait()  # maximise contention
        try:
            send_message(user=supplier, conversation_id=conv.id, body=body)
        finally:
            connection.close()

    def _read():
        barrier.wait()
        try:
            mark_read(user=hirer, conversation_id=conv.id)
        finally:
            connection.close()

    threads = [
        threading.Thread(target=_send, args=("first message",)),
        threading.Thread(target=_send, args=("second message",)),
        threading.Thread(target=_read),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Both messages persisted; the hirer's unread is whatever the read didn't
    # catch — never negative, never double-counted (0..2 depending on interleave).
    assert conv.messages.count() == 2
    remaining = unread_count(conv, hirer)
    assert 0 <= remaining <= 2
    # After a final settle read, unread is exactly zero.
    mark_read(user=hirer, conversation_id=conv.id)
    assert unread_count(conv, hirer) == 0
