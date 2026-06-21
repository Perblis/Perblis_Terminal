"""Messaging domain errors (stable codes, error envelope per TSD §3.8)."""

from __future__ import annotations

from rest_framework import status

from core.exceptions import TerminalError


class ConversationNotFound(TerminalError):
    """404 for a missing conversation **or** a non-participant — never leak
    existence to a third party (FSD §8 acceptance)."""

    status_code = status.HTTP_404_NOT_FOUND
    default_code = "conversation_not_found"
    default_detail = "Conversation not found."


class InvalidEnquiryTarget(TerminalError):
    """Enquiry create needs exactly one of ``listing_id`` / ``supplier_id``."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_enquiry_target"
    default_detail = "Provide exactly one of listing_id or supplier_id."


class CannotEnquireOwnListing(TerminalError):
    """A supplier can't open an enquiry against their own listing/storefront."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "cannot_enquire_own_listing"
    default_detail = "You can't start an enquiry on your own listing."


class EmptyMessage(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "empty_message"
    default_detail = "A message body is required."
