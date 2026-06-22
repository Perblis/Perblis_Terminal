"""Ops user moderation: the suspension cascade and strike adjust (wave-6 §6.7)."""

from __future__ import annotations

from typing import cast

import pytest
from django.test import RequestFactory

from accounts.errors import AccountSuspended
from accounts.factories import UserFactory
from accounts.models import User
from accounts.services import login, moderation
from hires.factories import HireFactory
from hires.models import Hire
from listings.enums import ListingStatus
from listings.factories import ListingFactory
from listings.models import Listing
from listings.services.storefront import get_storefront
from payments.enums import PayoutKind, PayoutState
from payments.models import Payout
from search.services.common import base_listings
from suppliers.factories import SupplierProfileFactory
from suppliers.models import SupplierProfile

pytestmark = pytest.mark.django_db

# Nigeria-wide bbox (PostGIS rejects a full antipodal envelope).
WORLD_BBOX = {"bbox": (2.0, 3.0, 15.0, 14.0)}


def test_suspension_cascade_blocks_login_search_storefront_and_freezes_payouts():
    """One walk through all four suspension effects (wave-6 mandatory)."""
    profile = cast(SupplierProfile, SupplierProfileFactory())
    supplier = profile.user
    listing = cast(Listing, ListingFactory(supplier=supplier, status=ListingStatus.LIVE))
    hire = cast(Hire, HireFactory(listing=listing, supplier=supplier))
    payout = Payout.objects.create(
        hire=hire,
        supplier=supplier,
        amount=hire.payout_amount,
        kind=PayoutKind.COMPLETION,
        state=PayoutState.DUE,
    )

    # Pre-suspension: listing is discoverable and the storefront resolves.
    assert listing.pk in {row.pk for row in base_listings(WORLD_BBOX)[0]}
    assert get_storefront(supplier_id=supplier.id)["live_listings"]

    moderation.suspend_user(supplier, reason="Fraudulent activity")

    # 1) Login blocked.
    request = RequestFactory().post("/api/v1/auth/login")
    with pytest.raises(AccountSuspended):
        login.authenticate(request=request, email=supplier.email, password="Terminal123")

    # 2) Listings hidden from search.
    assert listing.pk not in {row.pk for row in base_listings(WORLD_BBOX)[0]}

    # 3) Storefront 404s.
    from django.http import Http404

    with pytest.raises(Http404):
        get_storefront(supplier_id=supplier.id)

    # 4) Payouts frozen.
    payout.refresh_from_db()
    assert payout.state == PayoutState.FROZEN
    assert payout.frozen_reason == "account_suspended"


def test_reactivate_lifts_suspension_but_leaves_payouts_frozen():
    profile = cast(SupplierProfile, SupplierProfileFactory())
    supplier = profile.user
    hire = cast(Hire, HireFactory(supplier=supplier))
    payout = Payout.objects.create(
        hire=hire,
        supplier=supplier,
        amount=hire.payout_amount,
        kind=PayoutKind.COMPLETION,
        state=PayoutState.DUE,
    )
    moderation.suspend_user(supplier, reason="x")
    moderation.reactivate_user(supplier)

    supplier.refresh_from_db()
    assert supplier.is_suspended is False
    payout.refresh_from_db()
    assert payout.state == PayoutState.FROZEN  # Ops unfreezes deliberately


def test_suspend_bumps_token_version():
    user = cast(User, UserFactory())
    before = user.token_version
    moderation.suspend_user(user, reason="x")
    user.refresh_from_db()
    assert user.token_version == before + 1


def test_adjust_strikes_clamps_and_requires_profile():
    profile = SupplierProfileFactory()
    assert moderation.adjust_strikes(profile.user, delta=2, reason="late") == 2
    assert moderation.adjust_strikes(profile.user, delta=-5, reason="appeal") == 0  # clamped

    with pytest.raises(ValueError):
        moderation.adjust_strikes(UserFactory(), delta=1, reason="no profile")
