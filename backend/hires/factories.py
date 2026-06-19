"""factory-boy factories for the hires app."""

from __future__ import annotations

import datetime as dt

import factory
from django.utils import timezone

from accounts.factories import UserFactory
from listings.factories import ListingFactory

from . import fees
from .enums import HireStatus
from .models import Hire


def _quote(o):
    days = fees.duration_days(o.start_date, o.end_date)
    return fees.quote(
        o.listing.asset_class,
        days=days,
        daily_price=o.listing.daily_price,
        weekly_price=o.listing.weekly_price,
        monthly_price=o.listing.monthly_price,
    )


class HireFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Hire

    listing = factory.SubFactory(ListingFactory)
    hirer = factory.SubFactory(UserFactory)
    supplier = factory.LazyAttribute(lambda o: o.listing.supplier)
    yard = factory.LazyAttribute(lambda o: o.listing.yard)

    start_date = factory.LazyFunction(lambda: timezone.now().date() + dt.timedelta(days=7))
    end_date = factory.LazyAttribute(lambda o: o.start_date + dt.timedelta(days=2))  # 3 inclusive
    duration_days = factory.LazyAttribute(lambda o: fees.duration_days(o.start_date, o.end_date))

    scheme = factory.LazyAttribute(lambda o: _quote(o).scheme)
    fee_basis = factory.LazyAttribute(lambda o: _quote(o).fee_basis)
    hire_value = factory.LazyAttribute(lambda o: _quote(o).hire_value)
    service_fee = factory.LazyAttribute(lambda o: _quote(o).service_fee)
    payout_amount = factory.LazyAttribute(lambda o: _quote(o).payout_amount)

    status = HireStatus.REQUESTED
    request_expires_at = factory.LazyFunction(lambda: timezone.now() + dt.timedelta(hours=24))

    class Params:
        # An accepted hire holding a live payment window (holds dates).
        accepted = factory.Trait(
            status=HireStatus.ACCEPTED,
            payment_deadline=factory.LazyFunction(lambda: timezone.now() + dt.timedelta(hours=4)),
        )
        confirmed = factory.Trait(status=HireStatus.CONFIRMED)
        on_hire = factory.Trait(status=HireStatus.ON_HIRE)
