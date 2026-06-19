"""Hires-specific domain errors (stable codes for the error envelope)."""

from __future__ import annotations

from rest_framework import status

from core.exceptions import TerminalError


class InvalidTransition(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "hire_invalid_transition"
    default_detail = "That action isn't allowed from the hire's current state."


class TransitionNotPermitted(TerminalError):
    """The actor isn't allowed to drive this transition (wrong role)."""

    status_code = status.HTTP_403_FORBIDDEN
    default_code = "transition_not_permitted"
    default_detail = "You can't perform that action on this hire."


class AvailabilityConflict(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "availability_conflict"
    default_detail = "The asset isn't available for the requested dates."


class ReasonRequired(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "reason_required"
    default_detail = "A reason is required for this action."


class BasicCapExceeded(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "basic_cap_exceeded"
    default_detail = "Hire value exceeds the ₦250,000 cap for Basic accounts."


class PaymentWindowExpired(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "payment_window_expired"
    default_detail = "The 4-hour payment window has closed."


class HireNotFound(TerminalError):
    status_code = status.HTTP_404_NOT_FOUND
    default_code = "not_found"
    default_detail = "No such hire."


class ListingNotHireable(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "listing_not_hireable"
    default_detail = "This listing can't be hired right now."


class CannotHireOwnListing(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "cannot_hire_own_listing"
    default_detail = "You can't hire your own listing."
