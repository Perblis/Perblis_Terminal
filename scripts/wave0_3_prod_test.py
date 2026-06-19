#!/usr/bin/env python3
"""Production smoke test: Wave 0 infrastructure through Wave 3 discovery."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://perblisterminal-production.up.railway.app"
API = f"{BASE}/api/v1"


def get(path: str) -> tuple[int, dict | str]:
    try:
        with urllib.request.urlopen(f"{API}{path}" if path.startswith("/") else path, timeout=30) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def post(path: str, body: dict, token: str | None = None) -> tuple[int, dict | str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


class Suite:
    def __init__(self) -> None:
        self.ok = 0
        self.fail = 0
        self.errors: list[str] = []

    def check(self, name: str, cond: bool, detail: str = "") -> None:
        if cond:
            self.ok += 1
            print(f"PASS {name}" + (f" — {detail}" if detail else ""))
        else:
            self.fail += 1
            self.errors.append(f"{name}: {detail}")
            print(f"FAIL {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    s = Suite()

    # Wave 0 — infrastructure
    with urllib.request.urlopen(f"{BASE}/healthz", timeout=15) as r:
        health = json.loads(r.read())
    s.check("W0 healthz", health.get("status") == "ok")
    with urllib.request.urlopen(f"{BASE}/readyz", timeout=15) as r:
        ready = json.loads(r.read())
    s.check("W0 readyz database", ready.get("checks", {}).get("database") == "ok")

    # Wave 1 — auth (login with known demo account)
    code, body = post("/auth/login", {"email": "nwabueze@perblis.com", "password": "Qweruiop@1"})
    token = body.get("access") if isinstance(body, dict) else None
    s.check("W1 login", code == 200 and bool(token), str(code))

    code, me = get("/me") if not token else (200, {})  # placeholder
    if token:
        headers = {"Authorization": f"Bearer {token}"}
        req = urllib.request.Request(f"{API}/me", headers=headers)
        with urllib.request.urlopen(req) as r:
            me = json.loads(r.read())
    s.check("W1 GET /me", me.get("is_phone_verified") and me.get("is_email_verified"),
            f"supplier={me.get('is_supplier')} verified={me.get('is_verified')}")

    # Wave 2 — supply
    qs = urllib.parse.urlencode({"class": "plant_machinery", "type": "Excavator"})
    code, tpl = get(f"/spec-templates?{qs}")
    s.check("W2 spec-templates", code == 200 and tpl.get("asset_type") == "Excavator")

    if token:
        req = urllib.request.Request(f"{API}/yards", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as r:
            yards = json.loads(r.read())
        s.check("W2 yards list", len(yards.get("results", [])) >= 1, f"count={len(yards.get('results', []))}")

        req = urllib.request.Request(f"{API}/listings", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as r:
            listings = json.loads(r.read())
        live = [x for x in listings.get("results", []) if x.get("status") == "live"]
        s.check("W2 listings (live)", len(live) >= 1, f"live={len(live)}")

        user_id = me.get("id")
        code, storefront = get(f"/storefronts/{user_id}")
        s.check("W2 storefront", code == 200 and len(storefront.get("live_listings", [])) >= 1,
                f"live={len(storefront.get('live_listings', []))}")

    # Wave 3 — discovery (Apapa bbox around demo data)
  # Lagos Apapa corridor bbox
    bbox = "3.30,6.40,3.45,6.50"
    code, mmap = get(f"/search/map?bbox={bbox}")
    yards = mmap.get("yards", []) if isinstance(mmap, dict) else []
    solos = mmap.get("listings", []) if isinstance(mmap, dict) else []
    s.check("W3 search/map", code == 200, f"yards={len(yards)} solos={len(solos)} total_pins={len(yards)+len(solos)}")

    code, lst = get(f"/search/map?bbox={bbox}&asset_class=plant_machinery")
    s.check("W3 search/map filter", code == 200)

    code, lst = get(f"/search/list?bbox={bbox}&group_by=asset")
    results = lst.get("results", []) if isinstance(lst, dict) else []
    s.check("W3 search/list asset", code == 200 and isinstance(results, list), f"count={len(results)}")

    code, lst = get(f"/search/list?bbox={bbox}&group_by=location")
    results = lst.get("results", []) if isinstance(lst, dict) else []
    s.check("W3 search/list location", code == 200, f"count={len(results)}")

    code, geo = get("/geocode?q=Lagos")
    s.check("W3 geocode", code == 200 and "results" in geo,
            f"provider={geo.get('provider_configured') if isinstance(geo, dict) else '?'}")

    # Radius search
    code, mmap = get("/search/map?lat=6.4433&lng=3.3792&radius_km=25")
    s.check("W3 search/map radius", code == 200)

    print(f"\n{'='*50}")
    print(f"Results: {s.ok}/{s.ok + s.fail} passed")
    if s.errors:
        print("Failures:")
        for e in s.errors:
            print(f"  - {e}")
    return 0 if s.fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
