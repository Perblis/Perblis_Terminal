"""Listing service — create/update/read (FSD §5.2). All mutation lives here.

Location precedence (FSD §5.2 step ⑤): yard chip → explicit pin → geocoded
address. The resolved point is denormalised onto the listing. The completeness
score is computed and stored (ranking input later; not user-visible in MVP).
``status`` is never written here — that's the state machine (Slice 4).
"""

from __future__ import annotations

from django.contrib.gis.geos import Point
from django.db import transaction
from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404

from accounts.models import User
from listings import state
from listings.enums import ListingStatus, ListingTier
from listings.errors import ListingNotEditable
from listings.models import Listing, ListingPhoto, Unit
from listings.services.geocoding import geocode
from listings.services.specs import get_template, validate_specs
from suppliers.models import Yard
from suppliers.services.yards import nearest_yard_within

_SCALAR_FIELDS = (
    "title",
    "description",
    "daily_price",
    "weekly_price",
    "monthly_price",
    "unit_count",
)


def compute_completeness(asset_class: str, asset_type: str, specs: dict) -> float:
    """Fraction (0–1) of the template's fields the listing fills."""
    template = get_template(asset_class, asset_type)
    if template is None or not template.fields:
        return 0.0
    filled = sum(
        1 for name in template.fields if name in specs and specs[name] not in (None, "", [])
    )
    return round(filled / len(template.fields), 4)


def _resolve_location(
    yard: Yard | None, point: Point | None, address_text: str, city: str
) -> tuple[Point | None, str, str]:
    if yard is not None:
        return yard.point, address_text or yard.address_text, city or yard.city
    if point is not None:
        return point, address_text, city
    if address_text or city:
        return geocode(address_text, city), address_text, city
    return None, address_text, city


def list_listings(user: User) -> QuerySet[Listing]:
    return Listing.objects.filter(supplier=user)


def get_listing_for_view(*, listing_id, user) -> Listing:
    """A Live listing is public; anything else is visible only to its supplier."""
    listing = get_object_or_404(Listing, id=listing_id)
    if listing.status != ListingStatus.LIVE and not (
        user and user.is_authenticated and listing.supplier_id == user.id
    ):
        raise Http404()
    return listing


@transaction.atomic
def create_listing(
    *,
    user: User,
    asset_class: str,
    asset_type: str,
    title: str,
    description: str,
    specs: dict,
    daily_price: int,
    weekly_price: int | None = None,
    monthly_price: int | None = None,
    unit_count: int = 1,
    yard_id=None,
    point: Point | None = None,
    address_text: str = "",
    city: str = "",
    unit_labels: list[str] | None = None,
) -> tuple[Listing, Yard | None]:
    clean_specs, version = validate_specs(
        asset_class=asset_class, asset_type=asset_type, specs=specs
    )
    yard = get_object_or_404(Yard, id=yard_id, supplier=user) if yard_id else None
    resolved_point, addr, city = _resolve_location(yard, point, address_text, city)

    listing = Listing.objects.create(
        supplier=user,
        yard=yard,
        asset_class=asset_class,
        asset_type=asset_type,
        title=title,
        description=description,
        specs=clean_specs,
        spec_template_version=version,
        daily_price=daily_price,
        weekly_price=weekly_price,
        monthly_price=monthly_price,
        unit_count=unit_count,
        point=resolved_point,
        address_text=addr,
        city=city,
        completeness_score=compute_completeness(asset_class, asset_type, clean_specs),
    )
    for label in unit_labels or []:
        Unit.objects.create(listing=listing, label=label)

    # Auto-yard inference: a free pin near an existing yard → suggest attaching.
    suggestion = (
        nearest_yard_within(user=user, point=resolved_point)
        if resolved_point is not None and yard is None
        else None
    )
    return listing, suggestion


@transaction.atomic
def update_listing(*, user: User, listing_id, **fields) -> Listing:
    listing = get_object_or_404(Listing.objects.select_for_update(), id=listing_id, supplier=user)
    if listing.status in (ListingStatus.ARCHIVED, ListingStatus.REMOVED):
        raise ListingNotEditable()

    for name in _SCALAR_FIELDS:
        if name in fields:
            setattr(listing, name, fields[name])

    if "specs" in fields:
        clean_specs, version = validate_specs(
            asset_class=listing.asset_class, asset_type=listing.asset_type, specs=fields["specs"]
        )
        listing.specs = clean_specs
        listing.spec_template_version = version
        listing.completeness_score = compute_completeness(
            listing.asset_class, listing.asset_type, clean_specs
        )

    # Location edits: moving yard re-denormalises the point immediately.
    if any(k in fields for k in ("yard_id", "point", "address_text", "city")):
        if "yard_id" in fields:
            yard = (
                get_object_or_404(Yard, id=fields["yard_id"], supplier=user)
                if fields["yard_id"]
                else None
            )
        else:
            yard = listing.yard
        point = fields["point"] if "point" in fields else listing.point
        address_text = fields.get("address_text", listing.address_text)
        city = fields.get("city", listing.city)
        listing.yard, listing.point, listing.address_text, listing.city = (
            yard,
            *_resolve_location(yard, point, address_text, city),
        )

    listing.save()
    return listing


@transaction.atomic
def transition(*, user: User, listing_id, action: str) -> Listing:
    """Run a status transition through the state machine (the only status writer)."""
    listing = get_object_or_404(Listing.objects.select_for_update(), id=listing_id, supplier=user)
    return state.apply(listing, action)


@transaction.atomic
def duplicate_listing(*, user: User, listing_id, copy_photos: bool = False) -> Listing:
    """Create a new Draft copying class/type, specs, pricing, units, and yard.

    Tier resets to Basic. Copied photos reference the SAME public-bucket keys
    (no re-upload) — fleet ergonomics per ux/01 F9.
    """
    src = get_object_or_404(Listing, id=listing_id, supplier=user)
    dup = Listing.objects.create(
        supplier=user,
        yard=src.yard,
        asset_class=src.asset_class,
        asset_type=src.asset_type,
        title=src.title,
        description=src.description,
        specs=src.specs,
        spec_template_version=src.spec_template_version,
        daily_price=src.daily_price,
        weekly_price=src.weekly_price,
        monthly_price=src.monthly_price,
        unit_count=src.unit_count,
        point=src.point,
        address_text=src.address_text,
        city=src.city,
        status=ListingStatus.DRAFT,
        tier=ListingTier.BASIC,
        completeness_score=src.completeness_score,
    )
    Unit.objects.bulk_create([Unit(listing=dup, label=u.label) for u in src.units.all()])
    if copy_photos:
        ListingPhoto.objects.bulk_create(
            [
                ListingPhoto(listing=dup, r2_key=p.r2_key, position=p.position, is_cover=p.is_cover)
                for p in src.photos.all()
            ]
        )
    return dup
