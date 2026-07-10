#!/usr/bin/env python3
"""Seed live production with demo suppliers, yards, and Live listings via the public API.

Uses Ops admin channel-verify (Termii sender still pending) then the normal
supplier publish path. Namespaced emails: live-supply-<n>@perblis.com so they
are identifiable later.

Usage:
  ADMIN_PASSWORD='…' python3 scripts/seed_live_supply.py
  ADMIN_PASSWORD='…' python3 scripts/seed_live_supply.py --suppliers 8 --yards 12 --listings 40
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar

BASE = os.environ.get("API_BASE", "https://api-production-101c8.up.railway.app")
API = f"{BASE}/api/v1"
ADMIN = f"{BASE}/admin"

PASSWORD = os.environ.get("SEED_SUPPLIER_PASSWORD", "LiveSupply!Demo#2026")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "nwabueze@perblis.com")

# Dual Lagos corridors (Apapa + Lekki), same idea as seed_search_demo.
CORRIDORS = [(3.3650, 6.4400), (3.5000, 6.4450)]
JITTER = 0.025

# Minimal valid JPEG for R2 photo attach.
_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00"
    b"\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xaa\xff\xd9"
)

ASSET_CATALOG = [
    {
        "asset_class": "plant_machinery",
        "asset_type": "Excavator",
        "title": "CAT 320D Excavator",
        "specs": {
            "make": "Caterpillar",
            "model": "320D",
            "year": 2019,
            "condition": "Good",
            "operator_included": "Included",
            "operating_weight": 22,
        },
        "daily_price": 95_000_00,  # kobo
    },
    {
        "asset_class": "trucks_haulage",
        "asset_type": "Tipper / Dump Truck",
        "title": "Sinotruk Howo Tipper 30T",
        "specs": {
            "make": "Sinotruk",
            "model": "Howo",
            "year": 2021,
            "condition": "Excellent",
            "driver_included": "Included",
            "operating_range": "Lagos only",
            "payload_capacity": 30,
        },
        "daily_price": 120_000_00,
    },
    {
        "asset_class": "warehousing",
        "asset_type": "Dry Warehouse",
        "title": "Apapa Dry Warehouse Bay",
        "specs": {
            "security": ["Fenced", "CCTV", "Guards 24-7"],
            "floor_area": 1200,
            "power_supply": "Three-phase",
            "truck_access": "Trailer-accessible",
            "ceiling_height": 8,
        },
        "daily_price": 250_000_00,
    },
    {
        "asset_class": "terminals_yards",
        "asset_type": "Container Yard / Bonded Depot",
        "title": "Lekki Container Yard",
        "specs": {
            "total_area": 8000,
            "surface_type": "Concrete",
            "customs_status": "Bonded",
            "operating_hours": "Day shift",
            "container_capacity": 450,
            "handling_equipment": ["Reach stacker", "Forklift"],
        },
        "daily_price": 400_000_00,
    },
    {
        "asset_class": "land_staging",
        "asset_type": "Industrial Land",
        "title": "Ikorodu Staging Land",
        "specs": {
            "area": 5000,
            "fencing": "Fully fenced",
            "access_road": "Trailer-accessible",
            "surface_type": "Compacted laterite",
            "weight_bearing": "Heavy plant OK",
        },
        "daily_price": 80_000_00,
    },
]

BUSINESSES = [
    ("Apapa Heavy Plant Ltd", "Apapa Main Yard"),
    ("Lekki Haulage Partners", "Lekki Free Zone Yard"),
    ("Wharf Logistics Nigeria", "Tin Can Staging"),
    ("Lagos Crane & Rig Ltd", "Ijora Plant Depot"),
    ("Coastal Tippers Co", "Ajegunle Haul Yard"),
    ("Harbour Warehousing NG", "Apapa Warehouse Row"),
    ("Atlantic Container Services", "Lekki Bonded Yard"),
    ("Mainland Staging Grounds", "Ikorodu Laydown"),
    ("Delta Force Equipment", "Surulere Plant Bay"),
    ("Greenfield Earthworks Ltd", "Ojo Equipment Yard"),
    ("Portside Aggregates", "Apapa Tipper Park"),
    ("Eko Industrial Parks", "Lekki Industrial Land"),
]


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
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
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


class AdminClient:
    def __init__(self) -> None:
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def get(self, path: str) -> str:
        with self.opener.open(f"{ADMIN}{path}", timeout=45) as resp:
            return resp.read().decode()

    def post(self, path: str, data: dict[str, str], *, referer: str) -> str:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(
            f"{ADMIN}{path}",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded", "Referer": referer},
            method="POST",
        )
        with self.opener.open(req, timeout=45) as resp:
            return resp.read().decode()

    def login(self, email: str, password: str, otp_token: str = "") -> bool:
        login_path = "/login/?next=/admin/"
        html = self.get(login_path)
        csrf = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', html)
        if not csrf:
            return False
        payload = {
            "csrfmiddlewaretoken": csrf.group(1),
            "username": email,
            "password": password,
            "next": "/admin/",
        }
        if otp_token:
            payload["otp_token"] = otp_token
        self.post(
            login_path,
            payload,
            referer=f"{ADMIN}{login_path}",
        )
        home = self.get("/")
        return "Log in" not in home and "otp_token" not in home.lower()

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
            if name == "csrfmiddlewaretoken":
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
        for m in re.finditer(
            r'name="((?:phone_verified_at|email_verified_at)_[01])"[^>]*value="([^"]*)"',
            html,
        ):
            fields[m.group(1)] = m.group(2)
        return csrf, fields

    def promote_verified_supplier(self, email: str) -> None:
        uid = self.find_user_id(email)
        if not uid:
            raise RuntimeError(f"admin: user not found {email}")
        csrf, fields = self.parse_change_form(uid)
        now = datetime.now(timezone.utc)
        fields["csrfmiddlewaretoken"] = csrf
        fields["is_supplier"] = "on"
        fields["is_hirer"] = "on"
        fields["account_level"] = "verified"
        fields["phone_verified_at_0"] = now.strftime("%Y-%m-%d")
        fields["phone_verified_at_1"] = now.strftime("%H:%M:%S")
        fields["email_verified_at_0"] = now.strftime("%Y-%m-%d")
        fields["email_verified_at_1"] = now.strftime("%H:%M:%S")
        fields["_save"] = "Save"
        body = self.post(
            f"/accounts/user/{uid}/change/",
            fields,
            referer=f"{ADMIN}/accounts/user/{uid}/change/",
        )
        if "Please correct the errors below" in body:
            raise RuntimeError(f"admin save rejected for {email}")


def register(email: str, phone: str, full_name: str) -> None:
    code, body = request(
        "POST",
        "/auth/register",
        body={
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "password": PASSWORD,
            "accept_tos": True,
            "accept_privacy": True,
        },
    )
    if code == 201:
        return
    # Already exists is fine — we'll login after admin verify.
    if code == 400 and isinstance(body, dict):
        fields = (body.get("error") or {}).get("fields") or {}
        if "email" in fields or "phone" in fields:
            return
    raise RuntimeError(f"register failed {code}: {body}")


def login(email: str) -> str:
    code, body = request("POST", "/auth/login", body={"email": email, "password": PASSWORD})
    if code != 200 or not isinstance(body, dict) or not body.get("access"):
        raise RuntimeError(f"login failed {code}: {err_code(body) or body}")
    return body["access"]


def setup_supplier(token: str, business_name: str) -> None:
    request("POST", "/me/activate-supplier", token=token)
    code, body = request(
        "PATCH",
        "/suppliers/me/profile",
        token=token,
        body={
            "business_name": business_name,
            "description": (
                f"{business_name} — Terminal demo supplier for map discovery. "
                "Plant, haulage and staging assets across Lagos corridors."
            ),
            "bank_name": "GTBank",
            "bank_account_number": "0123456789",
            "bank_account_name": business_name[:50],
        },
    )
    if code != 200 or not (isinstance(body, dict) and body.get("is_complete")):
        raise RuntimeError(f"profile incomplete {code}: {body}")


def create_yard(token: str, name: str, lng: float, lat: float) -> str:
    code, body = request(
        "POST",
        "/yards",
        token=token,
        body={
            "name": name,
            "point": {"type": "Point", "coordinates": [lng, lat]},
            "address": f"{name}, Lagos",
            "city": "Lagos",
        },
    )
    if code != 201 or not isinstance(body, dict) or not body.get("id"):
        raise RuntimeError(f"yard create failed {code}: {body}")
    return body["id"]


def attach_photo(token: str, listing_id: str) -> None:
    code, presign = request(
        "POST",
        "/media/presign",
        token=token,
        body={"kind": "listing_photo", "content_type": "image/jpeg", "file_size": len(_JPEG)},
    )
    if code != 200 or not isinstance(presign, dict):
        raise RuntimeError(f"presign failed {code}: {presign}")
    put = urllib.request.Request(
        presign["presigned_put_url"],
        data=_JPEG,
        headers={"Content-Type": "image/jpeg"},
        method="PUT",
    )
    with urllib.request.urlopen(put, timeout=45) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f"R2 PUT {resp.status}")
    code, body = request(
        "POST",
        f"/listings/{listing_id}/photos",
        token=token,
        body={"r2_key": presign["key"]},
    )
    if code != 201:
        raise RuntimeError(f"attach photo failed {code}: {body}")


def create_and_publish(
    token: str,
    *,
    yard_id: str | None,
    point: tuple[float, float] | None,
    asset: dict,
    title_suffix: str,
) -> str:
    payload: dict = {
        "asset_class": asset["asset_class"],
        "asset_type": asset["asset_type"],
        "title": f"{asset['title']} — {title_suffix}",
        "description": (
            f"Demo Live listing for {asset['title']}. Suitable for Terminal map and hire-flow testing. "
            "Seeded via live-supply script."
        ),
        "specs": asset["specs"],
        "daily_price": asset["daily_price"],
    }
    if yard_id:
        payload["yard_id"] = yard_id
    elif point:
        payload["point"] = {"type": "Point", "coordinates": [point[0], point[1]]}
        payload["city"] = "Lagos"
    code, body = request("POST", "/listings", token=token, body=payload)
    if code != 201 or not isinstance(body, dict) or not body.get("id"):
        raise RuntimeError(f"listing create failed {code}: {body}")
    listing_id = body["id"]
    attach_photo(token, listing_id)
    code, body = request("POST", f"/listings/{listing_id}/publish", token=token)
    if code != 200:
        raise RuntimeError(f"publish failed {code}: {err_code(body) or body}")
    return listing_id


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suppliers", type=int, default=8)
    parser.add_argument("--yards", type=int, default=12)
    parser.add_argument("--listings", type=int, default=36)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_otp = os.environ.get("ADMIN_OTP", "").strip()
    if not admin_password:
        print("Set ADMIN_PASSWORD (Ops Console password).", file=sys.stderr)
        return 1
    if not admin_otp:
        print(
            "Set ADMIN_OTP to the current 6-digit code from your Ops Console authenticator.",
            file=sys.stderr,
        )
        return 1

    rng = random.Random(args.seed)
    n_suppliers = min(args.suppliers, len(BUSINESSES))
    admin = AdminClient()
    if not admin.login(ADMIN_EMAIL, admin_password, admin_otp):
        print("Admin login failed (check password + TOTP).", file=sys.stderr)
        return 1
    print(f"Admin OK — seeding {n_suppliers} suppliers on {BASE}")

    supplier_tokens: list[tuple[str, str, str]] = []  # email, business, token
    ts = int(time.time()) % 10_000_000

    for i in range(n_suppliers):
        business, _yard_label = BUSINESSES[i]
        email = f"live-supply-{i}@perblis.com"
        phone = f"0803{(ts + i * 17) % 10_000_000:07d}"
        print(f"[{i+1}/{n_suppliers}] register {email} …", flush=True)
        register(email, phone, f"Live Supply {i}")
        admin.promote_verified_supplier(email)
        token = login(email)
        setup_supplier(token, business)
        supplier_tokens.append((email, business, token))
        print(f"  supplier ready: {business}")

    # Create yards distributed across suppliers + corridors.
    yards: list[tuple[str, str, float, float]] = []  # yard_id, token, lng, lat
    for i in range(args.yards):
        email, business, token = supplier_tokens[i % len(supplier_tokens)]
        clng, clat = CORRIDORS[i % len(CORRIDORS)]
        lng = clng + rng.uniform(-JITTER, JITTER)
        lat = clat + rng.uniform(-JITTER, JITTER)
        name = f"{BUSINESSES[i % len(BUSINESSES)][1]} {i+1}"
        yard_id = create_yard(token, name, lng, lat)
        yards.append((yard_id, token, lng, lat))
        print(f"  yard: {name}")

    created = 0
    for i in range(args.listings):
        asset = ASSET_CATALOG[i % len(ASSET_CATALOG)]
        if rng.random() < 0.8:
            yard_id, token, _, _ = yards[i % len(yards)]
            point = None
            suffix = f"Yard {(i % len(yards)) + 1}"
            lid = create_and_publish(token, yard_id=yard_id, point=None, asset=asset, title_suffix=suffix)
        else:
            email, business, token = supplier_tokens[i % len(supplier_tokens)]
            clng, clat = CORRIDORS[rng.randrange(len(CORRIDORS))]
            point = (clng + rng.uniform(-JITTER, JITTER), clat + rng.uniform(-JITTER, JITTER))
            lid = create_and_publish(
                token,
                yard_id=None,
                point=point,
                asset=asset,
                title_suffix=f"Solo {i+1}",
            )
        created += 1
        if created % 5 == 0 or created == args.listings:
            print(f"  listings published: {created}/{args.listings}")

    # Verify map density.
    code, body = request(
        "GET",
        f"/search/map?bbox={urllib.parse.quote('3.2,6.3,3.7,6.6')}",
    )
    yards_n = len(body.get("yards", [])) if isinstance(body, dict) else 0
    listings_n = len(body.get("listings", [])) if isinstance(body, dict) else 0
    print(f"\nDone. Map viewport Apapa–Lekki: {yards_n} yard pins, {listings_n} solo pins.")
    print(f"Supplier logins: live-supply-0..{n_suppliers-1}@perblis.com / (SEED_SUPPLIER_PASSWORD)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
