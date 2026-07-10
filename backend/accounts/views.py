"""Accounts API views (auth/* and me/*).

Views are thin: validate input, call exactly one service, shape the response.
No domain mutation happens here — that all lives in `accounts.services.*`.
"""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils.decorators import method_decorator
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from accounts import serializers as s
from accounts.errors import OtpInvalid
from accounts.integrations import email as email_integration
from accounts.integrations import media
from accounts.models import User
from accounts.services import deletion, login, otp, password_reset, registration, verification
from accounts.services.tokens import TerminalTokenRefreshSerializer, tokens_for_user
from accounts.throttles import EmailOtpSendThrottle, OtpSendThrottle


class RegisterView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.RegisterSerializer
    throttle_scope = "auth"

    @extend_schema(responses={201: s.MeSerializer})
    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        user = registration.register_user(
            full_name=v["full_name"],
            email=v["email"],
            phone=v["phone"],
            password=v["password"],
        )
        return Response(s.MeSerializer(user).data, status=status.HTTP_201_CREATED)


class OtpVerifyView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.OtpVerifySerializer
    throttle_scope = "auth"

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.filter(phone=data.validated_data["phone"]).first()
        if user is None:
            raise OtpInvalid()
        otp.verify_phone_otp(user, data.validated_data["code"])
        return Response({"detail": "Phone verified."}, status=status.HTTP_200_OK)


class OtpResendView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.OtpResendSerializer
    throttle_classes = [OtpSendThrottle]

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.filter(phone=data.validated_data["phone"]).first()
        # No enumeration: respond identically whether the phone exists or not.
        # Delivery failures DO surface (OtpDeliveryFailed) — phone never fails silently.
        if user is not None and not user.is_phone_verified:
            otp.resend_phone_otp(user)
        return Response({"detail": "If the number is registered, a code was sent."})


class EmailOtpVerifyView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.EmailOtpVerifySerializer
    throttle_scope = "auth"

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=data.validated_data["email"]).first()
        if user is None:
            raise OtpInvalid()
        otp.verify_email_otp(user, data.validated_data["code"])
        return Response({"detail": "Email verified."}, status=status.HTTP_200_OK)


class EmailOtpResendView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.EmailOtpResendSerializer
    throttle_classes = [EmailOtpSendThrottle]

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=data.validated_data["email"]).first()
        # No enumeration: respond identically whether the email exists or not.
        if user is not None and not user.is_email_verified:
            otp.resend_email_otp(user)
        return Response({"detail": "If the email is registered, a code was sent."})


class LoginView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.LoginSerializer
    throttle_scope = "login"

    @extend_schema(responses={200: s.TokenPairSerializer})
    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = login.authenticate(
            request=request,
            email=data.validated_data["email"],
            password=data.validated_data["password"],
        )
        return Response(tokens_for_user(user))


class RefreshView(TokenRefreshView):
    # TokenRefreshView is already public (no auth/permissions required).
    serializer_class = TerminalTokenRefreshSerializer
    throttle_scope = "auth"


class LogoutView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = s.LogoutSerializer

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            RefreshToken(data.validated_data["refresh"]).blacklist()
        except TokenError:
            pass  # already invalid/expired — logout is idempotent
        return Response(status=status.HTTP_205_RESET_CONTENT)


class PasswordResetRequestView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.PasswordResetRequestSerializer
    throttle_scope = "auth"

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        password_reset.request_reset(email=data.validated_data["email"])
        # Always 200 — never reveal whether the email is registered.
        return Response({"detail": "If the email is registered, a reset link was sent."})


class PasswordResetConfirmView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = s.PasswordResetConfirmSerializer
    throttle_scope = "auth"

    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        password_reset.confirm_reset(
            raw_token=data.validated_data["token"],
            new_password=data.validated_data["new_password"],
        )
        return Response({"detail": "Password updated."})


class MeView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = s.MeSerializer

    def get(self, request):
        return Response(self.get_serializer(request.user).data)

    def patch(self, request):
        data = self.get_serializer(request.user, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        data.save()
        return Response(data.data)

    @extend_schema(responses={204: OpenApiResponse(description="Account soft-deleted.")})
    def delete(self, request):
        deletion.soft_delete_account(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActivateSupplierView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.MeSerializer})
    def post(self, request):
        user = request.user
        if not user.is_supplier:
            user.is_supplier = True
            user.save(update_fields=["is_supplier", "updated_at"])
        return Response(s.MeSerializer(user).data)


class BecomeSupplierView(APIView):
    """F8 hand-off: enable supplying on the account (idempotent) and email a
    link to the supplier portal, where the tools live. The app never implements
    supplier tools itself — this is the bridge."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "auth"

    @extend_schema(request=None, responses={200: s.MeSerializer})
    def post(self, request):
        user = request.user
        if not user.is_supplier:
            user.is_supplier = True
            user.save(update_fields=["is_supplier", "updated_at"])
        portal_url = settings.FRONTEND_BASE_URL.rstrip("/") + "/login"
        transaction.on_commit(
            lambda: email_integration.send_supplier_invite_email(
                to=user.email, full_name=user.full_name, portal_url=portal_url
            )
        )
        return Response(s.MeSerializer(user).data)


class VerificationView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "auth"

    def get_serializer_class(self):
        return (
            s.VerificationSubmitSerializer
            if self.request.method == "POST"
            else s.VerificationStatusSerializer
        )

    @extend_schema(responses={200: s.VerificationStatusSerializer})
    def get(self, request):
        status_data = verification.current_status(request.user)
        return Response(s.VerificationStatusSerializer(status_data).data)

    @extend_schema(
        request=s.VerificationSubmitSerializer,
        responses={201: s.VerificationRequestSerializer},
    )
    def post(self, request):
        data = s.VerificationSubmitSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        req = verification.submit_verification(
            user=request.user,
            kind=data.validated_data["kind"],
            files=data.validated_data["documents"],
            rc_number=data.validated_data.get("rc_number", ""),
        )
        return Response(s.VerificationRequestSerializer(req).data, status=status.HTTP_201_CREATED)


@method_decorator(extend_schema(exclude=True), name="get")
class PrivateDocView(APIView):
    """Ops-only stream view for private docs in local-media mode.

    Only reachable with a valid, unexpired signed token AND staff auth — there
    is no public path to a verification document.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            raise Http404()
        token = request.query_params.get("t", "")
        try:
            key = media.unsign_local_token(token)
        except Exception as exc:  # noqa: BLE001 - bad/expired token => 404
            raise Http404() from exc
        return FileResponse(iter([media.read_private_file(key)]), filename=key.split("/")[-1])
