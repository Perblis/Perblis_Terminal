#!/usr/bin/env python3
"""Production API smoke test for Wave 1 + Wave 2."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

BASE = "https://perblisterminal-production.up.railway.app"
API = f"{BASE}/api/v1"

ASSET_SAMPLES = [
    ("plant_machinery", "Excavator"),
    ("trucks_haulage", "Tipper / Dump Truck"),
    ("warehousing", "Dry Warehouse"),
    ("terminals_yards", "Container Yard / Bonded Depot"),
    ("land_staging", "Industrial Land"),
]


@dataclass
class Result:
    name: str
    ok: bool
    detail: str = ""
    status: int | None = None


@dataclass
class Suite:
    results: list[Result] = field(default_factory=list)
    ctx: dict = field(default_factory=dict)

    def record(self, name: str, ok: bool, detail: str = "", status: int | None = None) -> None:
        self.results.append(Result(name, ok, detail, status))
        mark = "PASS" if ok else "FAIL"
        line = f"[{mark}] {name}"
        if status is not None:
            line += f" (HTTP {status})"
        if detail:
            line += f" — {detail}"
        print(line)

    def summary(self) -> int:
        passed = sum(1 for r in self.results if r.ok)
        total = len(self.results)
        print(f"\n{'=' * 60}")
        print(f"Results: {passed}/{total} passed")
        failed = [r for r in self.results if not r.ok]
        if failed:
            print("Failures:")
            for r in failed:
                print(f"  - {r.name}: {r.detail}")
        if self.ctx.get("email"):
            print(f"\nTest account: {self.ctx['email']} / {self.ctx.get('phone', '?')}")
        return 0 if passed == total else 1


def request(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    token: str | None = None,
) -> tuple[int, dict | str]:
    url = f"{API}{path}" if path.startswith("/") else f"{API}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return exc.code, raw


def err_code(body: dict | str) -> str:
    if isinstance(body, dict):
        err = body.get("error") or {}
        if isinstance(err, dict):
            return str(err.get("code", ""))
    return ""


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=15) as resp:
        return json.loads(resp.read())


def test_infrastructure(suite: Suite) -> None:
    health = get_json(f"{BASE}/healthz")
    suite.record("healthz", health.get("status") == "ok", json.dumps(health))
    ready = get_json(f"{BASE}/readyz")
    checks = ready.get("checks", {})
    for name in ("database", "r2", "resend", "termii"):
        suite.record(f"readyz {name}", checks.get(name) in ("ok", "configured"), checks.get(name, ""))


def test_public_wave2(suite: Suite) -> None:
    for asset_class, asset_type in ASSET_SAMPLES:
        qs = urllib.parse.urlencode({"class": asset_class, "type": asset_type})
        code, body = request("GET", f"/spec-templates?{qs}")
        ok = code == 200 and isinstance(body, dict) and body.get("asset_type") == asset_type
        suite.record(f"spec-template {asset_class}/{asset_type}", ok, f"v={body.get('version') if ok else err_code(body)}", code)

    code, body = request("GET", "/spec-templates?class=plant_machinery&type=Nope")
    suite.record("spec-templates unknown", code == 404 and err_code(body) == "not_found", err_code(body), code)

    code, _ = request("GET", "/storefronts/00000000-0000-7000-8000-000000000001")
    suite.record("storefront missing supplier", code == 404, status=code)

    for path, method, payload in [
        ("/yards", "GET", None),
        ("/listings", "GET", None),
        ("/suppliers/me/profile", "GET", None),
        ("/media/presign", "POST", {"kind": "logo", "content_type": "image/png", "file_size": 100}),
    ]:
        code, _ = request(method, path, body=payload)
        suite.record(f"auth guard {method} {path}", code == 401, status=code)


def register_user(suite: Suite) -> tuple[str, str, str] | None:
    ts = int(time.time())
    email = os.environ.get("LIVE_TEST_EMAIL", f"live-test+{ts}@perblis.com")
    phone = os.environ.get("LIVE_TEST_PHONE", f"0803{ts % 10_000_000:07d}")
    password = os.environ.get("LIVE_TEST_PASSWORD", "LiveTest!Wave2#2026")
    suite.ctx.update({"email": email, "phone": phone, "password": password})

    code, body = request(
        "POST",
        "/auth/register",
        body={
            "full_name": "Live API Tester",
            "email": email,
            "phone": phone,
            "password": password,
            "accept_tos": True,
            "accept_privacy": True,
        },
    )
    if code == 201 and isinstance(body, dict):
        suite.record("register", True, email, code)
        suite.record(
            "register flags unverified",
            not body.get("is_phone_verified") and not body.get("is_email_verified"),
            status=code,
        )
        return email, phone, password

    # Re-use existing account if email taken
    if code == 400 and isinstance(body, dict) and "email" in (body.get("error", {}).get("fields") or {}):
        suite.record("register skipped", True, "using LIVE_TEST_EMAIL (already exists)", code)
        return email, phone, password

    suite.record("register", False, str(body)[:300], code)
    return None


def test_auth_channel(suite: Suite, email: str, phone: str, password: str) -> str | None:
    code, body = request("POST", "/auth/email/resend", body={"email": email})
    suite.record("email OTP resend", code == 200, status=code)

    code, body = request("POST", "/auth/otp/resend", body={"phone": phone})
    termii_ok = code == 200
    suite.record(
        "phone OTP resend (Termii)",
        termii_ok,
        "sent" if termii_ok else f"{err_code(body)} — sender 'Terminal' still pending on Termii",
        code,
    )

    email_code = os.environ.get("OTP_EMAIL_CODE", "")
    phone_code = os.environ.get("OTP_PHONE_CODE", "")
    if email_code:
        code, body = request("POST", "/auth/email/verify", body={"email": email, "code": email_code})
        suite.record("email verify", code == 200, err_code(body) or "verified", code)
    if phone_code:
        code, body = request("POST", "/auth/otp/verify", body={"phone": phone, "code": phone_code})
        suite.record("phone verify", code == 200, err_code(body) or "verified", code)

    code, body = request("POST", "/auth/login", body={"email": email, "password": password})
    if code == 200 and isinstance(body, dict) and body.get("access"):
        suite.record("login", True, "JWT issued", code)
        return body["access"]

    expected = err_code(body) in ("phone_not_verified", "email_not_verified", "invalid_credentials")
    suite.record("login blocked (expected without OTP)", expected, err_code(body), code)
    return None


def test_wave2_supplier_flow(suite: Suite, token: str) -> None:
    code, body = request("GET", "/me", token=token)
    user_id = body.get("id") if isinstance(body, dict) else None
    suite.record("GET /me", code == 200 and user_id, f"id={user_id}", code)

    code, body = request("POST", "/me/activate-supplier", token=token)
    suite.record("activate-supplier", code == 200, status=code)

    code, body = request("GET", "/suppliers/me/profile", token=token)
    suite.record("GET supplier profile (auto-create)", code == 200, status=code)

    code, body = request(
        "PATCH",
        "/suppliers/me/profile",
        token=token,
        body={
            "business_name": "Live Test Haulage Ltd",
            "description": "Automated production smoke test supplier profile with enough text.",
            "bank_name": "GTBank",
            "bank_account_number": "0123456789",
            "bank_account_name": "Live Test Haulage",
        },
    )
    masked = body.get("bank_account_number_masked") if isinstance(body, dict) else ""
    suite.record(
        "PATCH supplier profile complete",
        code == 200 and body.get("is_complete") is True,
        f"masked={masked}",
        code,
    )

    code, body = request(
        "POST",
        "/media/presign",
        token=token,
        body={"kind": "logo", "content_type": "image/png", "file_size": 1024},
    )
    suite.record(
        "media presign logo",
        code == 200 and bool(body.get("presigned_put_url")),
        f"bucket={body.get('bucket')}" if isinstance(body, dict) else str(body)[:80],
        code,
    )

    code, body = request(
        "POST",
        "/media/presign",
        token=token,
        body={"kind": "logo", "content_type": "application/pdf", "file_size": 1024},
    )
    suite.record("media presign rejects pdf logo", code == 400 and err_code(body) == "media_content_type_invalid", err_code(body), code)

    code, body = request(
        "POST",
        "/yards",
        token=token,
        body={
            "name": "Apapa Test Yard",
            "point": {"type": "Point", "coordinates": [3.3792, 6.4433]},
            "address": "Apapa Wharf Road",
            "city": "Lagos",
        },
    )
    yard_id = body.get("id") if isinstance(body, dict) else None
    suite.record("create yard", code == 201 and yard_id, f"id={yard_id}", code)

    code, body = request("GET", "/yards", token=token)
    count = len(body.get("results", [])) if isinstance(body, dict) else 0
    suite.record("list yards", code == 200 and count >= 1, f"count={count}", code)

    code, body = request(
        "POST",
        "/listings",
        token=token,
        body={
            "asset_class": "plant_machinery",
            "asset_type": "Excavator",
            "title": "CAT 320D Live Test",
            "description": "Production smoke test listing with sufficient description length for validation.",
            "specs": {
                "make": "Caterpillar",
                "model": "320D",
                "year": 2020,
                "condition": "Good",
                "operator_included": "Included",
            },
            "daily_price": 8000000,
            "yard_id": yard_id,
        },
    )
    listing_id = body.get("id") if isinstance(body, dict) else None
    suite.record(
        "create listing (draft)",
        code == 201 and listing_id and body.get("status") == "draft",
        f"id={listing_id}",
        code,
    )

    code, body = request("GET", f"/listings/{listing_id}", token=token)
    suite.record("GET own draft listing", code == 200, status=code)

    # Public cannot see draft
    code, _ = request("GET", f"/listings/{listing_id}")
    suite.record("draft listing hidden from public", code == 404, status=code)

    # Attach photo via R2
    code, presign = request(
        "POST",
        "/media/presign",
        token=token,
        body={"kind": "listing_photo", "content_type": "image/jpeg", "file_size": 2048},
    )
    photo_key = presign.get("key") if isinstance(presign, dict) else None
    if code == 200 and photo_key:
        jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
        put_req = urllib.request.Request(
            presign["presigned_put_url"],
            data=jpeg,
            headers={"Content-Type": "image/jpeg"},
            method="PUT",
        )
        try:
            with urllib.request.urlopen(put_req, timeout=30) as put_resp:
                suite.record("R2 presigned PUT upload", put_resp.status in (200, 201), status=put_resp.status)
        except urllib.error.HTTPError as exc:
            suite.record("R2 presigned PUT upload", False, exc.read().decode()[:100], exc.code)

        code, body = request("POST", f"/listings/{listing_id}/photos", token=token, body={"r2_key": photo_key})
        suite.record("attach listing photo", code == 201, status=code)

    code, body = request("POST", f"/listings/{listing_id}/publish", token=token)
    suite.record(
        "publish gate verification_required",
        code == 403 and err_code(body) == "verification_required",
        err_code(body),
        code,
    )

    if user_id:
        code, body = request("GET", f"/storefronts/{user_id}")
        suite.record("storefront (no live listings yet)", code in (200, 404), status=code)

    code, body = request(
        "POST",
        f"/listings/{listing_id}/duplicate",
        token=token,
        body={"copy_photos": True},
    )
    dup_id = body.get("id") if isinstance(body, dict) else None
    suite.record("duplicate listing", code == 201 and dup_id and body.get("status") == "draft", f"id={dup_id}", code)

    code, body = request("POST", f"/listings/{listing_id}/pause", token=token)
    suite.record("pause draft listing rejected", code in (400, 409), err_code(body), code)


def main() -> int:
    suite = Suite()
    test_infrastructure(suite)
    test_public_wave2(suite)

    creds = register_user(suite)
    if not creds:
        return suite.summary()

    email, phone, password = creds
    token = test_auth_channel(suite, email, phone, password)

    if token:
        test_wave2_supplier_flow(suite, token)
    else:
        print("\n--- Skipping authenticated Wave 2 flow (need OTP_EMAIL_CODE + OTP_PHONE_CODE) ---")

    return suite.summary()


if __name__ == "__main__":
    sys.exit(main())
