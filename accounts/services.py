import random
import string
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils import timezone

from .models import OTPCode, UserDocument

User = get_user_model()


def generate_otp_code():
    """Generate a 6-digit numeric OTP code."""
    return ''.join(random.choices(string.digits, k=6))


def create_otp(user, otp_type):
    """
    Create an OTP code for the user.
    MVP simulation: prints the code to console instead of sending SMS.
    """
    OTPCode.objects.filter(
        user=user,
        otp_type=otp_type,
        is_used=False,
    ).update(is_used=True)

    code = generate_otp_code()
    otp = OTPCode.objects.create(
        user=user,
        code=code,
        otp_type=otp_type,
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    print(f"[DEV OTP] User: {user.email} | Type: {otp_type} | Code: {code}")

    return otp


def verify_otp(user, code, otp_type):
    """
    Verify an OTP code. Returns True if valid, False otherwise.
    """
    try:
        otp = OTPCode.objects.get(
            user=user,
            code=code,
            otp_type=otp_type,
            is_used=False,
            expires_at__gt=timezone.now(),
        )
        otp.is_used = True
        otp.save()
        return True
    except OTPCode.DoesNotExist:
        return False


def send_welcome_email(user):
    """Send welcome email. Uses console backend in development."""
    send_mail(
        subject='Welcome to Terminal',
        message=(
            f"Hi {user.first_name},\n\n"
            "Welcome to Terminal — the one-stop platform for heavy asset leasing.\n\n"
            "You can now browse resources, list your assets, and manage bookings.\n\n"
            "The Terminal Team"
        ),
        from_email='noreply@terminal.app',
        recipient_list=[user.email],
        fail_silently=True,
    )


def send_password_reset_email(user, otp_code):
    """Send password reset OTP via email."""
    send_mail(
        subject='Terminal — Password Reset',
        message=(
            f"Hi {user.first_name},\n\n"
            f"Your password reset code is: {otp_code}\n\n"
            "This code expires in 10 minutes.\n\n"
            "If you did not request this, ignore this email.\n\n"
            "The Terminal Team"
        ),
        from_email='noreply@terminal.app',
        recipient_list=[user.email],
        fail_silently=True,
    )


def process_document_upload(user, document_file, document_type):
    """
    Upload a KYC document and auto-approve (MVP simulation).
    Sets user verification_level = 1 and is_id_verified = True.
    """
    doc = UserDocument.objects.create(
        user=user,
        document_file=document_file,
        document_type=document_type,
        status=UserDocument.STATUS_APPROVED,
    )

    user.is_id_verified = True
    user.verification_level = 1
    user.save(update_fields=['is_id_verified', 'verification_level'])

    print(f"[DEV KYC] Auto-approved document for {user.email} — {document_type}")

    return doc
