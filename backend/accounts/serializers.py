"""Request/response shapes for the accounts API.

Serializers validate and shape I/O only; all domain writes happen in
`accounts.services.*`. Password policy and phone normalisation live here because
they are field-level input concerns.
"""

from __future__ import annotations

import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.enums import VerificationKind
from accounts.models import User, VerificationRequest

_UPPER = re.compile(r"[A-Z]")
_DIGIT = re.compile(r"\d")


def normalize_ng_phone(value: str) -> str:
    """Best-effort normalisation of a Nigerian number to E.164 (+234…)."""
    raw = re.sub(r"[\s\-()]", "", value or "")
    if raw.startswith("+"):
        return raw
    if raw.startswith("234"):
        return "+" + raw
    if raw.startswith("0") and len(raw) == 11:
        return "+234" + raw[1:]
    if len(raw) == 10:  # bare subscriber number
        return "+234" + raw
    return raw


def validate_password_policy(password: str) -> str:
    if len(password) < 8 or not _UPPER.search(password) or not _DIGIT.search(password):
        raise serializers.ValidationError(
            "Password must be at least 8 characters and include an uppercase letter and a number."
        )
    validate_password(password)
    return password


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    accept_tos = serializers.BooleanField()
    accept_privacy = serializers.BooleanField()

    def validate_full_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Full name is required.")
        return value.strip()

    def validate_phone(self, value: str) -> str:
        normalised = normalize_ng_phone(value)
        if not re.fullmatch(r"\+[1-9]\d{1,14}", normalised):
            raise serializers.ValidationError("Enter a valid phone number.")
        return normalised

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value: str) -> str:
        return validate_password_policy(value)

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("accept_tos") or not attrs.get("accept_privacy"):
            raise serializers.ValidationError(
                "You must accept the Terms of Service and Privacy Policy."
            )
        if User.objects.filter(phone=attrs["phone"]).exists():
            raise serializers.ValidationError(
                {"phone": "An account with this phone number already exists."}
            )
        return attrs


class OtpVerifySerializer(serializers.Serializer):
    phone = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_phone(self, value: str) -> str:
        return normalize_ng_phone(value)


class OtpResendSerializer(serializers.Serializer):
    phone = serializers.CharField()

    def validate_phone(self, value: str) -> str:
        return normalize_ng_phone(value)


class EmailOtpVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)


class EmailOtpResendSerializer(serializers.Serializer):
    email = serializers.EmailField()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value: str) -> str:
        return validate_password_policy(value)


class MeSerializer(serializers.ModelSerializer):
    is_verified = serializers.BooleanField(read_only=True)
    is_phone_verified = serializers.BooleanField(read_only=True)
    is_email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "is_supplier",
            "is_hirer",
            "account_level",
            "is_phone_verified",
            "is_email_verified",
            "is_verified",
        ]
        read_only_fields = [
            "id",
            "email",
            "phone",
            "is_supplier",
            "is_hirer",
            "account_level",
        ]


class VerificationRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationRequest
        fields = ["id", "kind", "state", "reason", "rc_number", "created_at", "decided_at"]
        read_only_fields = fields


class VerificationStatusSerializer(serializers.Serializer):
    account_level = serializers.CharField()
    requests = VerificationRequestSerializer(many=True)


class VerificationSubmitSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=VerificationKind.choices)
    documents = serializers.ListField(
        child=serializers.FileField(), allow_empty=False, max_length=5
    )
    rc_number = serializers.CharField(required=False, allow_blank=True, max_length=32)

    def validate(self, attrs: dict) -> dict:
        if attrs["kind"] == VerificationKind.BUSINESS and not attrs.get("rc_number"):
            raise serializers.ValidationError(
                {"rc_number": "An RC number is required for business verification."}
            )
        return attrs
