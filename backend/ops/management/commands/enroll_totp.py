"""Provision a confirmed TOTP device for a staff account.

This is the founder's enrolment path for Ops Console 2FA and the lockout-recovery
lever: run it (on prod via a one-off shell) to mint a device, scan the printed
otpauth URL / QR in an authenticator app, then ``ADMIN_2FA_REQUIRED`` logins
work. Always enrol + verify a device BEFORE flipping 2FA on in prod.

    manage.py enroll_totp ops@example.com
    manage.py enroll_totp ops@example.com --rotate   # replace an existing device
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_otp.plugins.otp_totp.models import TOTPDevice


class Command(BaseCommand):
    help = "Enrol (or rotate) a confirmed TOTP device for a staff user and print its otpauth URL."

    def add_arguments(self, parser) -> None:
        parser.add_argument("email", help="Email of the staff user to enrol.")
        parser.add_argument("--name", default="default", help="Device name (default: 'default').")
        parser.add_argument(
            "--rotate",
            action="store_true",
            help="Replace an existing device of this name instead of erroring.",
        )
        parser.add_argument(
            "--no-qr",
            action="store_true",
            help="Print only the otpauth URL, not the ASCII QR code.",
        )

    def handle(self, *args, **opts) -> None:
        user_model = get_user_model()
        try:
            user = user_model.objects.get(email__iexact=opts["email"])
        except user_model.DoesNotExist as exc:
            raise CommandError(f"No user with email {opts['email']!r}.") from exc

        if not user.is_staff:
            raise CommandError(
                f"{user.email} is not staff — only staff use the Ops Console. Grant is_staff first."
            )

        name = opts["name"]
        existing = TOTPDevice.objects.filter(user=user, name=name)
        if existing.exists():
            if not opts["rotate"]:
                raise CommandError(
                    f"Device {name!r} already exists for {user.email}; pass --rotate to replace it."
                )
            existing.delete()

        device = TOTPDevice.objects.create(user=user, name=name, confirmed=True)
        url = device.config_url

        self.stdout.write(self.style.SUCCESS(f"Enrolled TOTP device {name!r} for {user.email}."))
        if not opts["no_qr"]:
            self._print_qr(url)
        self.stdout.write("Add this account to your authenticator app (otpauth URL):")
        self.stdout.write(url)

    def _print_qr(self, url: str) -> None:
        try:
            import qrcode

            qr = qrcode.QRCode(border=1)
            qr.add_data(url)
            qr.make(fit=True)
            qr.print_ascii(out=self.stdout)
        except Exception:  # pragma: no cover - QR is a convenience, never fatal
            self.stdout.write("(QR render unavailable; use the otpauth URL below.)")
