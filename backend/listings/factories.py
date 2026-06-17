"""factory-boy factories for the listings app."""

from __future__ import annotations

import factory
from django.contrib.gis.geos import Point

from listings.enums import AssetClass, ListingStatus
from listings.models import Listing, ListingPhoto, SpecTemplate
from suppliers.factories import SupplierUserFactory


class SpecTemplateFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = SpecTemplate

    asset_class = AssetClass.PLANT_MACHINERY
    asset_type = factory.Sequence(lambda n: f"Type {n}")
    version = 1
    fields = factory.LazyFunction(
        lambda: {
            "make": {
                "kind": "text",
                "required": True,
                "filterable": False,
                "display_name": "Make",
            }
        }
    )


class ListingFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Listing

    supplier = factory.SubFactory(SupplierUserFactory)
    asset_class = AssetClass.PLANT_MACHINERY
    asset_type = "Excavator"
    title = factory.Sequence(lambda n: f"CAT 320D #{n}")
    description = factory.LazyFunction(lambda: "Well-maintained excavator. " * 4)
    specs = factory.LazyFunction(dict)
    daily_price = 8_000_000  # ₦80,000 in kobo
    unit_count = 1
    status = ListingStatus.DRAFT
    point = factory.LazyFunction(lambda: Point(3.3792, 6.4433, srid=4326))


class ListingPhotoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ListingPhoto

    listing = factory.SubFactory(ListingFactory)
    r2_key = factory.Sequence(lambda n: f"listings/photo-{n}.jpg")
