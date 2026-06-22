"""Payments-specific domain errors (stable codes for the error envelope)."""

from __future__ import annotations

from rest_framework import status

from core.exceptions import TerminalError


class PaymentAttemptsExceeded(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "payment_attempts_exceeded"
    default_detail = "The maximum number of payment attempts has been reached."


class InvalidWebhookSignature(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_webhook_signature"
    default_detail = "The webhook signature could not be verified."


class NoPayment(TerminalError):
    status_code = status.HTTP_404_NOT_FOUND
    default_code = "no_payment"
    default_detail = "No payment has been initialized for this hire yet."


class CheckoutUnavailable(TerminalError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "checkout_unavailable"
    default_detail = "Payment checkout could not be opened. Try again shortly."


class PayoutFrozen(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "payout_frozen"
    default_detail = "This payout is frozen; unfreeze it before marking it paid."


class PayoutAlreadyPaid(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "payout_already_paid"
    default_detail = "This payout has already been paid."
