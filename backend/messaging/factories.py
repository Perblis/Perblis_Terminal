"""Factory-boy factories for messaging tests."""

from __future__ import annotations

import factory

from accounts.factories import UserFactory
from listings.factories import ListingFactory

from .enums import ConversationKind
from .masking import mask
from .models import Conversation, Message


class ConversationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Conversation

    kind = ConversationKind.ENQUIRY
    listing = factory.SubFactory(ListingFactory)
    supplier = factory.LazyAttribute(lambda o: o.listing.supplier if o.listing else None)
    hirer = factory.SubFactory(UserFactory)

    class Params:
        # Storefront "general" enquiry: no listing, explicit supplier.
        general = factory.Trait(listing=None, supplier=factory.SubFactory(UserFactory))


class MessageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Message

    conversation = factory.SubFactory(ConversationFactory)
    sender = factory.LazyAttribute(lambda o: o.conversation.hirer)
    body = "Hello, is this available?"
    body_masked = factory.LazyAttribute(lambda o: mask(o.body))
