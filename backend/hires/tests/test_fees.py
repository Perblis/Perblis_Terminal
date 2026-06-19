"""Fee engine tests (FSD §3.1).

The five worked examples in the FSD are *test vectors* — they are reproduced
here verbatim and must pass byte-for-byte. The hypothesis properties guard the
invariants the spec leans on: the floor, the accounting identity, monotonicity,
and best-price optimality.
"""

from __future__ import annotations

import datetime as dt
import math

import pytest
from hypothesis import given
from hypothesis import strategies as st

from core.money import kobo
from hires import fees
from hires.enums import Scheme
from listings.enums import AssetClass

# --- The five FSD §3.1 worked examples, verbatim ----------------------------
# (label, asset_class, days, daily, weekly, monthly | naira) ->
#   (hire_value, service_fee, payout | naira, scheme)
WORKED_EXAMPLES = [
    (
        "excavator daily x3",
        AssetClass.PLANT_MACHINERY,
        3,
        80_000,
        None,
        None,
        240_000,
        28_800,
        211_200,
        Scheme.DAILY,
    ),
    (
        "excavator weekly wins (14d)",
        AssetClass.PLANT_MACHINERY,
        14,
        80_000,
        450_000,
        None,
        900_000,
        90_000,
        810_000,
        Scheme.WEEKLY,
    ),
    (
        "same listing daily wins (8d)",
        AssetClass.PLANT_MACHINERY,
        8,
        80_000,
        450_000,
        None,
        640_000,
        76_800,
        563_200,
        Scheme.DAILY,
    ),
    (
        "generator hits the fee floor",
        AssetClass.PLANT_MACHINERY,
        1,
        15_000,
        None,
        None,
        15_000,
        2_500,
        12_500,
        Scheme.DAILY,
    ),
    (
        "warehouse monthly",
        AssetClass.WAREHOUSING,
        30,
        None,
        None,
        350_000,
        350_000,
        21_000,
        329_000,
        Scheme.MONTHLY,
    ),
]


@pytest.mark.parametrize(
    "label,asset_class,days,daily,weekly,monthly,value,fee,payout,scheme",
    WORKED_EXAMPLES,
    ids=[e[0] for e in WORKED_EXAMPLES],
)
def test_worked_examples(
    label, asset_class, days, daily, weekly, monthly, value, fee, payout, scheme
):
    q = fees.quote(
        asset_class,
        days=days,
        daily_price=kobo(daily) if daily is not None else None,
        weekly_price=kobo(weekly) if weekly is not None else None,
        monthly_price=kobo(monthly) if monthly is not None else None,
    )
    assert q.hire_value == kobo(value)
    assert q.service_fee == kobo(fee)
    assert q.payout_amount == kobo(payout)
    assert q.scheme == scheme


def test_fee_basis_string_is_human_readable():
    q = fees.quote(
        str(AssetClass.WAREHOUSING), days=30, daily_price=None, monthly_price=kobo(350_000)
    )
    assert q.fee_basis == "6% monthly (min ₦2,500)"


# --- duration --------------------------------------------------------------
def test_duration_is_inclusive():
    assert fees.duration_days(dt.date(2026, 1, 1), dt.date(2026, 1, 1)) == 1
    assert fees.duration_days(dt.date(2026, 1, 1), dt.date(2026, 1, 3)) == 3


def test_duration_rejects_end_before_start():
    with pytest.raises(ValueError):
        fees.duration_days(dt.date(2026, 1, 3), dt.date(2026, 1, 1))


def test_quote_rejects_no_scheme_set():
    with pytest.raises(ValueError):
        fees.quote(str(AssetClass.PLANT_MACHINERY), days=3, daily_price=None)


def test_quote_rejects_zero_days():
    with pytest.raises(ValueError):
        fees.quote(str(AssetClass.PLANT_MACHINERY), days=0, daily_price=kobo(80_000))


def test_quote_rejects_unknown_asset_class():
    with pytest.raises(ValueError):
        fees.quote("teleporters", days=3, daily_price=kobo(80_000))


def test_tie_resolves_to_longer_scheme():
    # daily×7 == weekly×1 exactly → the longer (weekly, lower-rate) scheme wins.
    q = fees.quote(
        str(AssetClass.PLANT_MACHINERY),
        days=7,
        daily_price=kobo(10_000),
        weekly_price=kobo(70_000),
    )
    assert q.scheme == Scheme.WEEKLY
    assert q.hire_value == kobo(70_000)


# --- hypothesis properties --------------------------------------------------
_price = st.integers(min_value=1, max_value=50_000_000)  # kobo
_days = st.integers(min_value=1, max_value=400)
_klass = st.sampled_from(list(AssetClass))


@given(
    klass=_klass, days=_days, daily=_price, weekly=st.none() | _price, monthly=st.none() | _price
)
def test_accounting_identity(klass, days, daily, weekly, monthly):
    q = fees.quote(klass, days=days, daily_price=daily, weekly_price=weekly, monthly_price=monthly)
    assert q.payout_amount + q.service_fee == q.hire_value


@given(
    klass=_klass, days=_days, daily=_price, weekly=st.none() | _price, monthly=st.none() | _price
)
def test_floor_always_honoured(klass, days, daily, weekly, monthly):
    q = fees.quote(klass, days=days, daily_price=daily, weekly_price=weekly, monthly_price=monthly)
    assert q.service_fee >= fees.FEE_FLOOR


@given(klass=_klass, daily=_price, days=_days)
def test_hire_value_monotonic_in_days(klass, daily, days):
    # With only a daily rate set, a longer hire never costs less.
    a = fees.quote(klass, days=days, daily_price=daily)
    b = fees.quote(klass, days=days + 1, daily_price=daily)
    assert b.hire_value >= a.hire_value


@given(
    klass=_klass, days=_days, daily=_price, weekly=st.none() | _price, monthly=st.none() | _price
)
def test_best_price_optimality(klass, days, daily, weekly, monthly):
    """No set scheme yields a lower total than the one chosen."""
    q = fees.quote(klass, days=days, daily_price=daily, weekly_price=weekly, monthly_price=monthly)
    totals = [daily * days]
    if weekly is not None:
        totals.append(weekly * math.ceil(days / 7))
    if monthly is not None:
        totals.append(monthly * math.ceil(days / 30))
    assert q.hire_value == min(totals)
