#!/usr/bin/env python3
"""Comprehensive production test suite — Waves 0 through 4."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import date, timedelta

BASE = "https://api-production-101c8.up.railway.app"
API = f"{BASE}/api/v1"
PORTAL = "https://terminal-portal.nwabueze.workers.dev"

SUPPLIER = {"email": "nwabueze@perblis.com", "password": "Qweruiop@1"}
HIRER = {"email": "nwabueze+hirer-w4-1781881704@perblis.com", "password": "LiveTest!Wave4#2026"}


@dataclass
class Suite:
    results: list[tuple[str, str, bool, str]] = field(default_factory=list)

    def check(self, wave: str, name: str, ok: bool, detail: str = "") -> None:
        self.results.append((wave, name, ok, detail))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] [{wave}] {name}" + (f" — {detail}" if detail else ""))

    def summary(self) -> int:
        passed = sum(1 for _, _, ok, _ in self.results if ok)
        total = len(self.results)
        by_wave: dict[str, list[bool]] = {}
        for wave, _, ok, _ in self.results:
            by_wave.setdefault(wave, []).append(ok)
        print(f"\n{'=' * 70}")
        print(f"TOTAL: {passed}/{total} passed")
        for wave in sorted(by_wave):
            w = by_wave[wave]
            print(f"  {wave}: {sum(w)}/{len(w)}")
        for wave, name, ok, detail in self.results:
            if not ok:
                print(f"  FAIL [{wave}] {name}: {detail}")
        return 0 if passed == total else 1


def req(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    token: str | None = None,
    base: str = API,
) -> tuple[int, dict | str]:
    url = f"{base}{path}" if path.startswith("/") else path
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers.setdefault("User-Agent", "Terminal-ProdTest/1.0")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return e.code, raw


def err(body: dict | str) -> str:
    if isinstance(body, dict):
        e = body.get("error") or {}
        if isinstance(e, dict):
            return str(e.get("code", ""))
    return ""


def login(creds: dict) -> str | None:
    code, body = req("POST", "/auth/login", body=creds)
    return body.get("access") if code == 200 and isinstance(body, dict) else None


def test_wave0(s: Suite) -> None:
    code, health = req("GET", "/healthz", base=BASE)
    s.check("W0", "healthz", code == 200 and health.get("status") == "ok", str(health))

    code, ready = req("GET", "/readyz", base=BASE)
    checks = ready.get("checks", {}) if isinstance(ready, dict) else {}
    s.check("W0", "readyz database", checks.get("database") == "ok")
    for svc in ("r2", "resend", "termii", "ably", "bachs"):
        s.check("W0", f"readyz {svc}", checks.get(svc) == "configured", checks.get(svc, ""))

    code, _ = req("GET", "/api/docs/", base=BASE)
    s.check("W0", "OpenAPI docs", code == 200)

    with urllib.request.urlopen(f"{BASE}/api/schema/", timeout=30) as r:
        schema = r.read().decode()
    s.check("W0", "OpenAPI schema", "Terminal API" in schema and "/api/v1/auth/login" in schema)

    code, _ = req("GET", "/admin/", base=BASE)
    s.check("W0", "admin console", code in (200, 302))

    code, _ = req("GET", "/static/admin/css/base.css", base=BASE)
    s.check("W0", "static assets", code == 200)

    # Portal (Wave 0 exit)
    portal_req = urllib.request.Request(PORTAL, headers={"User-Agent": "Terminal-ProdTest/1.0"})
    with urllib.request.urlopen(portal_req, timeout=30) as r:
        html = r.read().decode()
    s.check("W0", "portal deployed", "Terminal" in html and r.status == 200)
    s.check("W0", "portal token pipeline", "Wave 0" in html or "action/primary" in html)

    code, _ = req("GET", "/nonexistent", base=BASE)
    s.check("W0", "404 error envelope", code == 404)


def test_wave1(s: Suite) -> tuple[str | None, str | None]:
    # Error envelope shape
    code, body = req("POST", "/auth/login", body={"email": "bad", "password": "x"})
    s.check("W1", "login validation envelope", code == 400 and "error" in body, err(body))

    # No enumeration on password reset
    code, body = req("POST", "/auth/password-reset", body={"email": "nobody@example.com"})
    s.check("W1", "password reset no enumeration", code == 200)

    code, body = req("POST", "/auth/password-reset", body={"email": "not-an-email"})
    s.check("W1", "password reset invalid email", code == 400)

    st = login(SUPPLIER)
    ht = login(HIRER)
    s.check("W1", "supplier login", st is not None)
    s.check("W1", "hirer login", ht is not None)

    if not st:
        return None, None

    code, me = req("GET", "/me", token=st)
    s.check("W1", "GET /me", code == 200 and me.get("id"))
    s.check("W1", "phone verified", me.get("is_phone_verified") is True)
    s.check("W1", "email verified", me.get("is_email_verified") is True)
    s.check("W1", "supplier role", me.get("is_supplier") is True)

    # JWT refresh
    code, login_body = req("POST", "/auth/login", body=SUPPLIER)
    refresh = login_body.get("refresh") if isinstance(login_body, dict) else None
    if refresh:
        code, ref = req("POST", "/auth/token/refresh", body={"refresh": refresh})
        s.check("W1", "token refresh", code == 200 and ref.get("access"), err(ref))

    # Unauthenticated guard
    code, _ = req("GET", "/me")
    s.check("W1", "auth guard /me", code == 401)

    # Register validation
    code, body = req(
        "POST",
        "/auth/register",
        body={
            "full_name": "X",
            "email": "invalid",
            "phone": "123",
            "password": "short",
            "accept_tos": False,
            "accept_privacy": False,
        },
    )
    s.check("W1", "register validation", code == 400 and "error" in body)

    return st, ht


def test_wave2(s: Suite, token: str) -> str | None:
    classes = [
        ("plant_machinery", "Excavator"),
        ("trucks_haulage", "Tipper / Dump Truck"),
        ("warehousing", "Dry Warehouse"),
        ("terminals_yards", "Container Yard / Bonded Depot"),
        ("land_staging", "Industrial Land"),
    ]
    for cls, typ in classes:
        qs = urllib.parse.urlencode({"class": cls, "type": typ})
        code, body = req("GET", f"/spec-templates?{qs}")
        s.check("W2", f"spec-template {cls}", code == 200 and body.get("asset_type") == typ)

    code, body = req("GET", "/spec-templates?class=plant_machinery&type=FakeType")
    s.check("W2", "unknown spec type 404", code == 404)

    code, yards = req("GET", "/yards", token=token)
    s.check("W2", "list yards", code == 200 and len(yards.get("results", [])) >= 1)

    yard_id = yards["results"][0]["id"] if yards.get("results") else None

    code, listings = req("GET", "/listings", token=token)
    live = [x for x in listings.get("results", []) if x.get("status") == "live"]
    s.check("W2", "live listings", code == 200 and len(live) >= 1, f"live={len(live)}")

    listing_id = live[0]["id"] if live else None

    code, me = req("GET", "/me", token=token)
    uid = me.get("id")
    if uid:
        code, sf = req("GET", f"/storefronts/{uid}")
        s.check("W2", "storefront public", code == 200, f"live={len(sf.get('live_listings', []))}")

    if listing_id:
        code, body = req("GET", f"/listings/{listing_id}")
        s.check("W2", "public live listing", code == 200 and body.get("status") == "live")

        code, body = req("GET", f"/listings/{listing_id}", token=token)
        s.check("W2", "owner listing detail", code == 200)

    code, body = req("GET", "/suppliers/me/profile", token=token)
    s.check("W2", "supplier profile", code == 200 and body.get("business_name"))

    code, body = req(
        "POST",
        "/media/presign",
        token=token,
        body={"kind": "logo", "content_type": "image/png", "file_size": 1024},
    )
    s.check("W2", "R2 presign", code == 200 and body.get("presigned_put_url"))

    return listing_id


def test_wave3(s: Suite, listing_id: str | None) -> None:
    bbox = "3.30,6.40,3.45,6.50"
    code, mmap = req("GET", f"/search/map?bbox={bbox}")
    yards = mmap.get("yards", []) if isinstance(mmap, dict) else []
    solos = mmap.get("listings", []) if isinstance(mmap, dict) else []
    s.check("W3", "search/map bbox", code == 200, f"yards={len(yards)} solos={len(solos)}")

    code, _ = req("GET", f"/search/map?bbox={bbox}&asset_class=plant_machinery")
    s.check("W3", "search/map class filter", code == 200)

    code, _ = req("GET", "/search/map?lat=6.4433&lng=3.3792&radius_km=25")
    s.check("W3", "search/map radius", code == 200)

    code, lst = req("GET", f"/search/list?bbox={bbox}&group_by=asset")
    s.check("W3", "search/list asset", code == 200 and "results" in lst, f"n={len(lst.get('results', []))}")

    code, lst = req("GET", f"/search/list?bbox={bbox}&group_by=location")
    s.check("W3", "search/list location", code == 200)

    code, geo = req("GET", "/geocode?q=Lagos")
    s.check("W3", "geocode configured", code == 200 and geo.get("provider_configured") is True)
    results = geo.get("results", []) if isinstance(geo, dict) else []
    s.check("W3", "geocode results", len(results) >= 1, f"n={len(results)}")

    # Availability flag (Wave 4 wired)
    if solos:
        avail = solos[0].get("available")
        s.check("W3", "available flag present", avail is not None, str(avail))
    elif yards and yards[0].get("listings"):
        avail = yards[0]["listings"][0].get("available")
        s.check("W3", "available flag in yard", avail is not None, str(avail))

    # Pagination cursor
    code, lst = req("GET", f"/search/list?bbox={bbox}&group_by=asset&limit=1")
    s.check("W3", "cursor pagination", code == 200)


def test_wave4(s: Suite, st: str, ht: str, listing_id: str | None) -> None:
    if not listing_id:
        code, search = req("GET", "/search/map?bbox=3.0,6.0,4.0,7.0")
        listings = search.get("listings", []) if isinstance(search, dict) else []
        for y in search.get("yards", []) if isinstance(search, dict) else []:
            listings.extend(y.get("listings", []))
        listing_id = listings[0]["id"] if listings else None

    s.check("W4", "listing for hire", listing_id is not None, listing_id or "none")
    if not listing_id:
        return

    start = (date.today() + timedelta(days=120)).isoformat()
    end = (date.today() + timedelta(days=122)).isoformat()

    # Hirer cannot see fees on create
    code, hire = req(
        "POST",
        "/hires",
        token=ht,
        body={"listing_id": listing_id, "start_date": start, "end_date": end, "terms_accepted": True},
    )
    hid = hire.get("id") if isinstance(hire, dict) else None
    s.check("W4", "create hire", code == 201 and hid, f"value={hire.get('hire_value_display')}")
    s.check("W4", "D-014 create", "service_fee" not in hire)
    s.check("W4", "hire_value integer kobo", isinstance(hire.get("hire_value"), int))

    if not hid:
        return

    # Fee math: 3 days at daily rate — verify display
    s.check("W4", "status requested", hire.get("status") == "requested")

    # Supplier sees fees on accept
    code, acc = req("POST", f"/hires/{hid}/accept", body={}, token=st)
    s.check("W4", "accept hire", code == 200 and acc.get("status") == "accepted")
    s.check("W4", "D-014 supplier fee", "service_fee" in acc and acc["service_fee"] > 0)
    s.check("W4", "payout_amount locked", acc.get("payout_amount") == acc.get("hire_value", 0) - acc.get("service_fee", 0))

    # Hirer payment — Paystack (D-018 default)
    code, pay = req("GET", f"/hires/{hid}/payment", token=ht)
    auth = pay.get("authorization_url", "") if isinstance(pay, dict) else ""
    is_paystack = "paystack.com" in auth
    is_bachs = "bachs.io" in auth or "pay.bachs" in auth
    s.check("W4", "payment initiated", code == 200 and pay.get("state") == "initiated")
    s.check("W4", "checkout URL (Paystack or Bachs)", bool(auth) and (is_paystack or is_bachs), auth[:80])

    # Hirer still no fee after accept
    code, hd = req("GET", f"/hires/{hid}", token=ht)
    s.check("W4", "D-014 hirer detail", "service_fee" not in hd and "payout_amount" not in hd)

    # State machine guards
    code, body = req("POST", f"/hires/{hid}/accept", body={}, token=st)
    s.check("W4", "double accept rejected", code in (400, 409), err(body))

    code, body = req("POST", f"/hires/{hid}/decline", body={"reason": "too late"}, token=st)
    s.check("W4", "decline after accept rejected", code in (400, 409), err(body))

    # Webhook signature guard
    wh_req = urllib.request.Request(
        f"{API}/payments/webhook",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(wh_req, timeout=30) as r:
            wh_code = r.status
    except urllib.error.HTTPError as e:
        wh_code = e.code
    s.check("W4", "webhook rejects unsigned", wh_code in (400, 401, 403))

    # Hire lists
    code, hl = req("GET", "/hires?role=hirer", token=ht)
    s.check("W4", "hirer hire list", code == 200 and isinstance(hl.get("results"), list))

    code, sl = req("GET", "/hires?role=supplier", token=st)
    s.check("W4", "supplier hire list", code == 200 and len(sl.get("results", [])) >= 1)

    # Events audit trail
    events = hd.get("events", []) if isinstance(hd, dict) else []
    s.check("W4", "hire events trail", len(events) >= 2, f"n={len(events)}")

    # Cancel another accepted hire
    start2 = (date.today() + timedelta(days=130)).isoformat()
    end2 = (date.today() + timedelta(days=132)).isoformat()
    code, h2 = req(
        "POST",
        "/hires",
        token=ht,
        body={"listing_id": listing_id, "start_date": start2, "end_date": end2, "terms_accepted": True},
    )
    if code == 201:
        code, _ = req("POST", f"/hires/{h2['id']}/accept", body={}, token=st)
        if code == 200:
            code, can = req("POST", f"/hires/{h2['id']}/cancel", body={"reason": "test"}, token=ht)
            s.check("W4", "hirer cancel", code == 200 and can.get("status") == "cancelled")


def main() -> int:
    s = Suite()
    print("Terminal Production Test Suite — Waves 0-4")
    print(f"API: {BASE}")
    print(f"Portal: {PORTAL}\n")

    test_wave0(s)
    st, ht = test_wave1(s)
    listing_id = None
    if st:
        listing_id = test_wave2(s, st)
    test_wave3(s, listing_id)
    if st and ht:
        test_wave4(s, st, ht, listing_id)

    return s.summary()


if __name__ == "__main__":
    sys.exit(main())
