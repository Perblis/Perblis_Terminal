"""Masking matrix (FSD §8 acceptance, TSD §3.10) — pure, no DB."""

from __future__ import annotations

import pytest

from messaging.masking import contains_contact, mask

PHONES = [
    "call me on 08031234567",
    "0803 123 4567 is my line",
    "0803-123-4567",
    "0803.123.4567",
    "+2348031234567 whatsapp",
    "+234 803 123 4567",
    "2348031234567",
    "my number 0701 234 5678 ok",
]

EMAILS = [
    "reach me at john.doe@example.com please",
    "Sales+ng@firm.co.uk",
]

BENIGN = [
    "the price is 250,000 naira",
    "₦1,500,000 for the week",
    "RC 1234567 is our reg",
    "I need 12 units by 2026-06-21",
    "order 100 units at 5000 each",
    "invoice 0042 total 89000",
    "5 @ 100 per day",
    "model CAT 320 D2L",
]


@pytest.mark.parametrize("text", PHONES + EMAILS)
def test_contact_is_masked(text):
    assert contains_contact(text)
    assert mask(text) != text
    # the digits/address themselves must be gone
    assert "•••" in mask(text)


@pytest.mark.parametrize("text", BENIGN)
def test_benign_numerics_untouched(text):
    assert not contains_contact(text)
    assert mask(text) == text


@pytest.mark.django_db
def test_message_factory_stores_masked_copy():
    from messaging.factories import MessageFactory

    msg = MessageFactory(body="ring me 08031234567")
    assert "08031234567" not in msg.body_masked
    assert msg.body == "ring me 08031234567"
