#!/usr/bin/env python3
"""Ops admin: login, verify a user, promote supplier, set account level."""

from __future__ import annotations

import argparse
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar

BASE = "https://perblisterminal-production.up.railway.app"
ADMIN = f"{BASE}/admin"


class AdminClient:
    def __init__(self) -> None:
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def get(self, path: str) -> str:
        with self.opener.open(f"{ADMIN}{path}", timeout=30) as resp:
            return resp.read().decode()

    def post(self, path: str, data: dict[str, str], *, referer: str) -> str:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(
            f"{ADMIN}{path}",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded", "Referer": referer},
            method="POST",
        )
        with self.opener.open(req, timeout=30) as resp:
            return resp.read().decode()

    def login(self, email: str, password: str) -> bool:
        login_path = "/login/?next=/admin/"
        referer = f"{ADMIN}{login_path}"
        html = self.get(login_path)
        csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', html)
        if not csrf:
            return False
        self.post(
            login_path,
            {
                "csrfmiddlewaretoken": csrf.group(1),
                "username": email,
                "password": password,
                "next": "/admin/",
            },
            referer=referer,
        )
        home = self.get("/")
        return "Site administration" in home and "sessionid" in [c.name for c in self.jar]

    def find_user_id(self, email: str) -> str | None:
        qs = urllib.parse.urlencode({"q": email})
        html = self.get(f"/accounts/user/?{qs}")
        m = re.search(r"/admin/accounts/user/([0-9a-f-]{36})/change/", html)
        return m.group(1) if m else None

    def parse_change_form(self, user_id: str) -> tuple[str, dict[str, str]]:
        html = self.get(f"/accounts/user/{user_id}/change/")
        csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', html).group(1)
        fields: dict[str, str] = {}

        for m in re.finditer(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', html):
            name = m.group(1)
            if name in {"csrfmiddlewaretoken"}:
                continue
            fields[name] = m.group(2)

        for m in re.finditer(
            r'<select[^>]*name="([^"]+)"[^>]*>\s*<option value="([^"]*)" selected',
            html,
            re.DOTALL,
        ):
            fields[m.group(1)] = m.group(2)

        for m in re.finditer(r'<input[^>]*type="checkbox"[^>]*name="([^"]+)"[^>]*checked', html):
            fields[m.group(1)] = "on"

        # Datetime fields: 0_date + 0_time suffixes
        for m in re.finditer(
            r'name="(phone_verified_at|email_verified_at)_0_([^"]+)"[^>]*value="([^"]*)"',
            html,
        ):
            prefix = m.group(1)
            part = m.group(2)
            fields[f"{prefix}_0_{part}"] = m.group(3)

        return csrf, fields

    def save_user(self, user_id: str, updates: dict[str, str]) -> None:
        csrf, fields = self.parse_change_form(user_id)
        fields["csrfmiddlewaretoken"] = csrf
        fields.update(updates)
        fields["_save"] = "Save"
        referer = f"{ADMIN}/accounts/user/{user_id}/change/"
        body = self.post(f"/accounts/user/{user_id}/change/", fields, referer=referer)
        if "Please correct the errors below" in body:
            raise RuntimeError("Admin save rejected — check user form fields")


def django_admin_datetime(dt: datetime) -> dict[str, str]:
    """Split a datetime into Django admin's _0_date / _0_time field names."""
    local = dt.astimezone(timezone.utc)
    date = local.strftime("%Y-%m-%d")
    time = local.strftime("%H:%M:%S")
    return {
        "phone_verified_at_0_date": date,
        "phone_verified_at_0_time": time,
        "email_verified_at_0_date": date,
        "email_verified_at_0_time": time,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--admin-email", default="nwabueze@perblis.com")
    parser.add_argument("--admin-password", required=True)
    parser.add_argument("--target-email", required=True)
    parser.add_argument("--verify-channels", action="store_true")
    parser.add_argument("--supplier", action="store_true")
    parser.add_argument("--account-level", default="verified")
    args = parser.parse_args()

    client = AdminClient()
    if not client.login(args.admin_email, args.admin_password):
        print("Admin login failed", file=sys.stderr)
        return 1
    print("Admin login OK")

    uid = client.find_user_id(args.target_email)
    if not uid:
        print(f"User not found: {args.target_email}", file=sys.stderr)
        return 1
    print(f"Found user id={uid}")

    updates: dict[str, str] = {}
    if args.verify_channels:
        updates.update(django_admin_datetime(datetime.now(timezone.utc)))
    if args.supplier:
        updates["is_supplier"] = "on"
        updates["is_hirer"] = "on"
    if args.account_level:
        updates["account_level"] = args.account_level

    client.save_user(uid, updates)
    print(f"Updated {args.target_email}: {', '.join(k for k in updates if not k.endswith('_time'))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
