"""factory-boy factories for the suppliers app."""

from __future__ import annotations

import factory
from django.contrib.gis.geos import Point

from accounts.factories import UserFactory
from suppliers.models import SupplierProfile, Yard


class SupplierUserFactory(UserFactory):
    """A verified supplier — ready to publish once a profile is complete."""

    is_supplier = True
    account_level = "verified"


class SupplierProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = SupplierProfile

    user = factory.SubFactory(SupplierUserFactory)
    business_name = factory.Sequence(lambda n: f"Heavy Lift {n} Ltd")
    description = "Plant and machinery hire across Lagos."
    bank_name = "Zenith Bank"
    # Assigned plaintext; the model encrypts it at rest.
    bank_account_number_enc = "0123456789"
    bank_account_name = factory.LazyAttribute(lambda o: o.business_name)


class YardFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Yard

    supplier = factory.SubFactory(SupplierUserFactory)
    name = factory.Sequence(lambda n: f"Yard {n}")
    # Apapa, Lagos (lng, lat).
    point = factory.LazyFunction(lambda: Point(3.3792, 6.4433, srid=4326))
    city = "Lagos"
