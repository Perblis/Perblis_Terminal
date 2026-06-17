"""Listings-specific domain errors (stable codes for the error envelope)."""

from __future__ import annotations

from rest_framework import status

from core.exceptions import TerminalError


class InvalidAssetType(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_asset_type"
    default_detail = "Unknown asset class/type — no spec template exists."


class SpecInvalid(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "spec_invalid"
    default_detail = "One or more spec fields are invalid."


class ListingNotEditable(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "listing_not_editable"
    default_detail = "Archived or removed listings cannot be edited."


class InvalidTransition(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "listing_invalid_transition"
    default_detail = "That status change is not allowed from the listing's current state."


class PhotoLimitExceeded(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "photo_limit_exceeded"
    default_detail = "A listing can have at most 10 photos."


class PhotoNotFound(TerminalError):
    status_code = status.HTTP_404_NOT_FOUND
    default_code = "photo_not_found"
    default_detail = "That photo does not belong to this listing."


# --- Publish gates (FSD §5.2) ----------------------------------------------


class PublishRequiresDailyPrice(TerminalError):
    default_code = "publish_requires_daily_price"
    default_detail = "Set a daily price before publishing."


class PublishRequiresPhoto(TerminalError):
    default_code = "publish_requires_photo"
    default_detail = "Add at least one photo before publishing."


class PublishRequiresLocation(TerminalError):
    default_code = "publish_requires_location"
    default_detail = "Set a location (yard, pin, or address) before publishing."


class PublishRequiresSpecs(TerminalError):
    default_code = "publish_requires_specs"
    default_detail = "Fill all required spec fields before publishing."


class VerificationRequired(TerminalError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "verification_required"
    default_detail = "Your account must be verified before publishing."


class BusinessProfileIncomplete(TerminalError):
    default_code = "business_profile_incomplete"
    default_detail = "Complete your business profile (name + bank details) before publishing."
