"""Money helpers: integer kobo only, with float rejection (commandment 2)."""

from __future__ import annotations

import pytest

from core import money


def test_kobo_naira_round_trip():
    assert money.kobo(1) == 100
    assert money.naira(money.kobo(1_250_000)) == 1_250_000
    assert money.naira(125_000_000) == 1_250_000


def test_display_formats_naira_with_separators():
    assert money.display(125_000_000) == "₦1,250,000"
    assert money.display(0) == "₦0"
    assert money.display(money.kobo(2_500)) == "₦2,500"


@pytest.mark.parametrize("bad", [19.99, 100.0, "100", None])
def test_kobo_rejects_non_int(bad):
    with pytest.raises(TypeError):
        money.kobo(bad)


@pytest.mark.parametrize("bad", [19.99, "100", None])
def test_naira_and_display_reject_non_int(bad):
    with pytest.raises(TypeError):
        money.naira(bad)
    with pytest.raises(TypeError):
        money.display(bad)


def test_bool_is_not_money():
    # bool is an int subclass in Python; money helpers must still reject it.
    with pytest.raises(TypeError):
        money.kobo(True)
