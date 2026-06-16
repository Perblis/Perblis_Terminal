"""factory-boy factories for the accounts app."""

from __future__ import annotations

import factory
from django.utils import timezone

from accounts.enums import VerificationKind, VerificationState
from accounts.models import OtpCode, User, VerificationRequest

DEFAULT_PASSWORD = "Terminal123"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    full_name = factory.Sequence(lambda n: f"Test User {n}")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    phone = factory.Sequence(lambda n: f"+23480{n:08d}")
    is_hirer = True
    is_supplier = False
    # Fully verified by default so the user can log in; use the traits below for
    # registration/OTP scenarios.
    phone_verified_at = factory.LazyFunction(timezone.now)
    email_verified_at = factory.LazyFunction(timezone.now)

    class Params:
        # Brand-new registrant: neither channel verified yet.
        unverified = factory.Trait(phone_verified_at=None, email_verified_at=None)
        phone_unverified = factory.Trait(phone_verified_at=None)
        email_unverified = factory.Trait(email_verified_at=None)
        staff = factory.Trait(is_staff=True, is_superuser=True)

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", DEFAULT_PASSWORD)
        return model_class.objects.create_user(password=password, **kwargs)


class OtpCodeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = OtpCode

    user = factory.SubFactory(UserFactory)
    code_hash = "x" * 64
    expires_at = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(minutes=10))


class VerificationRequestFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = VerificationRequest

    user = factory.SubFactory(UserFactory)
    kind = VerificationKind.IDENTITY
    state = VerificationState.PENDING
    doc_keys = factory.LazyFunction(lambda: ["verification/x/y/z.pdf"])
