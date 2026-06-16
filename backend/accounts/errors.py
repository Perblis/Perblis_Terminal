"""Accounts-specific domain errors.

Each carries a stable `default_code` that clients branch on; the central
`core.exceptions.terminal_exception_handler` renders them as the error
envelope ``{"error": {"code", "message", "fields"?}}``. These codes are part
of the auth contract frozen at the end of Wave 1 — do not rename them.
"""

from __future__ import annotations

from rest_framework import status

from core.exceptions import TerminalError


class InvalidCredentials(TerminalError):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_code = "invalid_credentials"
    default_detail = "Email or password is incorrect."


class AccountSuspended(TerminalError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "account_suspended"
    default_detail = "This account is suspended."


class AccountDeleted(TerminalError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "account_deleted"
    default_detail = "This account has been deleted."


class PhoneNotVerified(TerminalError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "phone_not_verified"
    default_detail = "Verify your phone number before signing in."


class EmailNotVerified(TerminalError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "email_not_verified"
    default_detail = "Verify your email address before signing in."


class OtpDeliveryFailed(TerminalError):
    # Surfaced (never swallowed) so phone OTP can't silently fail: if SMS can't
    # be delivered we say so rather than pretend a code was sent.
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = "otp_delivery_failed"
    default_detail = "We couldn't send your verification code. Please try again."


class LoginLocked(TerminalError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_code = "login_locked"
    default_detail = "Too many failed sign-in attempts. Try again later."


class OtpInvalid(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "otp_invalid"
    default_detail = "That verification code is incorrect."


class OtpExpired(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "otp_expired"
    default_detail = "That verification code has expired. Request a new one."


class OtpAttemptsExceeded(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "otp_attempts_exceeded"
    default_detail = "Too many attempts. Request a new verification code."


class OtpResendThrottled(TerminalError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_code = "otp_resend_throttled"
    default_detail = "You have requested too many codes. Try again later."


class VerificationPending(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "verification_pending"
    default_detail = "A verification request of this kind is already pending."


class VerificationDocInvalid(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "verification_doc_invalid"
    default_detail = "The uploaded document is invalid."


class ResetTokenInvalid(TerminalError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "reset_token_invalid"
    default_detail = "This password-reset link is invalid or has expired."


class ActiveHireGuard(TerminalError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "active_hire_guard"
    default_detail = "You cannot delete your account while you have active hires."
