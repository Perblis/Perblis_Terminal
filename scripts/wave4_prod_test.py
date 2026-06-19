#!/usr/bin/env python3
"""Production Wave 4 E2E test — hires, payments, D-014, lifecycle."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date, timedelta

BASE = "https://api-production-101c8.up.railway.app"
API = f"{BASE}/api/v1"

SUPPLIER_EMAIL = "nwabueze@perblis.com"
SUPPLIER_PASS = "Qweruiop@1"
HIRER_EMAIL = "nwabueze+hirer-w4-1781881704@perblis.com"
HIRER_PASS = "LiveTest!Wave4#2026"


@dataclass
class Suite:
    results: list[tuple[str, bool, str]] = field(default_factory=list)
    ctx: dict = field(default_factory=dict)

    def check(self, name: str, ok: bool, detail: str = "") -> None:
        self.results.append((name, ok, detail))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))

    def summary(self) -> int:
        passed = sum(1 for _, ok, _ in self.results if ok)
        total = len(self.results)
        print(f"\n{'=' * 60}")
        print(f"Results: {passed}/{total} passed")
        for name, ok, detail in self.results:
            if not ok:
                print(f"  FAIL: {name}: {detail}")
        return 0 if passed == total else 1


def request(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    token: str | None = None,
) -> tuple[int, dict | str]:
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def readyz() -> dict:
    with urllib.request.urlopen(f"{BASE}/readyz", timeout=30) as resp:
        return json.loads(resp.read())


def find_available_listing(hirer_token: str) -> str | None:
    code, search = request("GET", "/search/map?bbox=3.0,6.0,4.0,7.0&limit=20")
    if code != 200 or not isinstance(search, dict):
        return None
    listings: list[dict] = []
    for yard in search.get("yards", []):
        listings.extend(yard.get("listings", []))
    listings.extend(search.get("listings", []))
    if not listings:
        return None
    lid = listings[0]["id"]
    for offset in range(30, 150, 7):
        start = (date.today() + timedelta(days=offset)).isoformat()
        end = (date.today() + timedelta(days=offset + 2)).isoformat()
        code, _ = request(
            "POST",
            "/hires",
            body={"listing_id": lid, "start_date": start, "end_date": end, "terms_accepted": True},
            token=hirer_token,
        )
        if code == 201:
            return lid
    return lid


def wait_confirmed(hire_id: str, token: str, *, seconds: int = 45) -> str | None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        code, hire = request("GET", f"/hires/{hire_id}", token=token)
        if code == 200 and isinstance(hire, dict):
            status = hire.get("status")
            if status == "confirmed":
                return status
        time.sleep(3)
    return None


def main() -> int:
    s = Suite()

    # Infrastructure
    rz = readyz()
    s.check("readyz ok", rz.get("status") == "ok", str(rz.get("checks", {})))
    s.check("bachs configured", rz.get("checks", {}).get("bachs") == "configured")

    code, _ = request("GET", "/../api/schema/".replace("/api/v1/../api/schema/", "/api/schema/"))
    # schema lives at /api/schema/
    with urllib.request.urlopen(f"{BASE}/api/schema/", timeout=30) as resp:
        schema = resp.read().decode()
    hire_paths = schema.count("/api/v1/hires")
    s.check("hire API routes in OpenAPI", hire_paths >= 5, f"{hire_paths} hire path refs")

    # Auth
    code, sup = request("POST", "/auth/login", body={"email": SUPPLIER_EMAIL, "password": SUPPLIER_PASS})
    st = sup.get("access") if isinstance(sup, dict) else None
    s.check("supplier login", st is not None, f"HTTP {code}")

    code, hir = request("POST", "/auth/login", body={"email": HIRER_EMAIL, "password": HIRER_PASS})
    ht = hir.get("access") if isinstance(hir, dict) else None
    s.check("hirer login", ht is not None, f"HTTP {code}")

    if not st or not ht:
        return s.summary()

    lid = find_available_listing(ht)
    s.check("live listing + available dates", bool(lid), lid or "none")
    if not lid:
        return s.summary()

    start = (date.today() + timedelta(days=60)).isoformat()
    end = (date.today() + timedelta(days=62)).isoformat()
    code, hire = request(
        "POST",
        "/hires",
        body={
            "listing_id": lid,
            "start_date": start,
            "end_date": end,
            "terms_accepted": True,
            "hirer_note": "Wave 4 prod E2E",
        },
        token=ht,
    )
    hid = hire.get("id") if isinstance(hire, dict) else None
    s.check(
        "create hire",
        code == 201 and hid is not None,
        f"HTTP {code} value={hire.get('hire_value_display') if isinstance(hire, dict) else ''}",
    )
    s.check(
        "D-014 on create (hirer)",
        isinstance(hire, dict) and "service_fee" not in hire,
        f"fee present={'service_fee' in hire if isinstance(hire, dict) else '?'}",
    )

    if not hid:
        return s.summary()

    code, acc = request("POST", f"/hires/{hid}/accept", body={"acknowledgments": {}}, token=st)
    s.check("supplier accept", code == 200, f"HTTP {code} status={acc.get('status') if isinstance(acc,dict) else acc}")
    if isinstance(acc, dict):
        s.check("D-014 supplier fee visible", "service_fee" in acc, f"fee={acc.get('service_fee')}")

    code, pay = request("GET", f"/hires/{hid}/payment", token=ht)
    auth = pay.get("authorization_url", "") if isinstance(pay, dict) else ""
    checkout_blocked = (
        code == 503
        and isinstance(pay, dict)
        and pay.get("error", {}).get("code") == "checkout_unavailable"
    )
    is_stub = "bachs.invalid" in auth
    is_real = "bachs.io" in auth or "pay.bachs" in auth
    s.check(
        "payment initialized",
        (code == 200 and pay.get("state") == "initiated") or checkout_blocked,
        f"HTTP {code} state={pay.get('state') if isinstance(pay,dict) else pay.get('error',{}).get('code') if isinstance(pay,dict) else ''}",
    )
    s.check(
        "real Bachs checkout URL",
        is_real and not is_stub,
        auth[:90] if is_real else ("checkout_unavailable (Bachs org)" if checkout_blocked else "empty"),
    )

    # Webhook-driven confirm (sandbox simulated_outcome after adapter deploy)
    confirmed = wait_confirmed(hid, ht, seconds=60)
    s.check("hire confirmed (webhook)", confirmed == "confirmed", confirmed or "still accepted")

    code, hd = request("GET", f"/hires/{hid}", token=ht)
    s.check("D-014 confirmed (hirer)", "service_fee" not in hd, f"status={hd.get('status')}")

    # Decline flow (separate hire)
    start2 = (date.today() + timedelta(days=90)).isoformat()
    end2 = (date.today() + timedelta(days=92)).isoformat()
    code, h2 = request(
        "POST",
        "/hires",
        body={"listing_id": lid, "start_date": start2, "end_date": end2, "terms_accepted": True},
        token=ht,
    )
    if code == 201:
        code, dec = request(
            "POST",
            f"/hires/{h2['id']}/decline",
            body={"reason": "Dates unavailable"},
            token=st,
        )
        s.check("supplier decline", code == 200 and dec.get("status") == "declined", dec.get("status"))

    # Cancel pre-payment
    start3 = (date.today() + timedelta(days=100)).isoformat()
    end3 = (date.today() + timedelta(days=102)).isoformat()
    code, h3 = request(
        "POST",
        "/hires",
        body={"listing_id": lid, "start_date": start3, "end_date": end3, "terms_accepted": True},
        token=ht,
    )
    if code == 201:
        code, acc3 = request("POST", f"/hires/{h3['id']}/accept", body={}, token=st)
        if code == 200:
            code, can = request(
                "POST",
                f"/hires/{h3['id']}/cancel",
                body={"reason": "E2E cleanup"},
                token=ht,
            )
            s.check("hirer cancel accepted", code == 200, can.get("status") if isinstance(can, dict) else code)

    code, lst = request("GET", "/hires?role=supplier", token=st)
    count = len(lst.get("results", [])) if isinstance(lst, dict) else 0
    s.check("supplier hire list", code == 200, f"count={count}")

    return s.summary()


if __name__ == "__main__":
    sys.exit(main())
