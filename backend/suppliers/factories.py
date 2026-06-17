"""factory-boy factories for the suppliers app."""

from __future__ import annotations

import factory

from accounts.factories import UserFactory
from suppliers.models import SupplierProfile


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
