"""Seed a realistic demonstration marketplace (suppliers → listings → hires).

Replaces placeholder demo data with supply that reads like the real Nigerian
heavy-asset market: named businesses at real industrial locations, listings with
genuine photography and complete spec sheets, and a hire history walked through
the actual state machine so timelines, money and messages all hang together.

    manage.py seed_market                       # seed (photos downloaded)
    manage.py seed_market --no-photos           # skip the photo pipeline
    manage.py seed_market --clear --yes         # remove everything it created

What it does *not* do is simulate trust. Accounts are marked verified the way
Ops would mark them, listings go Live only by passing the real publish gates,
and every hire transition goes through ``hires.state.apply`` and writes a
HireEvent. No provider is ever called: payment and payout rows are written
directly as settled demo records, which is why this command refuses to touch a
database that holds any non-demo hire (see ``_guard_real_data``).

Data lives in ``core.seed.market_data``; photo provenance in
``core.seed.photos.json``.
"""

from __future__ import annotations

import datetime as dt
import json
import secrets
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.seed.market_data import DEMO_EMAIL_DOMAIN, HIRE_SCRIPT, HIRERS, SOLO_LISTINGS, SUPPLIERS

# The placeholder seeder this command supersedes; --clear removes its rows too
# so the two demo generations can never overlap on the map.
LEGACY_EMAIL_PREFIX = "search-demo-"

PHOTO_MANIFEST = Path(__file__).resolve().parent.parent.parent / "seed" / "photos.json"
PHOTO_TIMEOUT = 45
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # matches the listing_photo media kind cap
USER_AGENT = "TerminalSeeder/1.0 (+https://perblis.com)"


class Command(BaseCommand):
    help = "Seed a realistic demo marketplace (suppliers, yards, listings, hires, messages)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Remove all demo data this command created (and the legacy search-demo rows).",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm a destructive --clear without the interactive prompt.",
        )
        parser.add_argument(
            "--password",
            default="",
            help="Password for every demo account. Generated and printed if omitted.",
        )
        parser.add_argument(
            "--no-photos",
            action="store_true",
            help="Skip photo download/upload. Listings stay Draft (publish needs a photo).",
        )
        parser.add_argument(
            "--photos-dir",
            default="",
            help="Read photos from this directory instead of downloading (offline re-runs).",
        )
        parser.add_argument(
            "--notify",
            action="store_true",
            help="Allow email/realtime side-effects. Off by default — demo addresses are undeliverable.",
        )

    def handle(self, *args, **opts):
        self.opts = opts
        if opts["clear"]:
            return self._clear(confirmed=opts["yes"])

        self._guard_real_data()
        password = opts["password"] or f"Demo-{secrets.token_urlsafe(9)}"
        with _notifications_muted(enabled=not opts["notify"]):
            summary = self._seed(password)
        self._report(summary, password, generated=not opts["password"])

    # --- guards -------------------------------------------------------------
    def _guard_real_data(self) -> None:
        """Refuse to run where genuine hires exist.

        The seeder writes settled Payment/Payout rows without a provider call.
        That is honest demo data in an empty system and corrupt data in a live
        one, so the safe default is to stop rather than mix the two.
        """
        from accounts.models import User
        from hires.models import Hire

        demo_or_legacy = User.objects.filter(email__endswith=f"@{DEMO_EMAIL_DOMAIN}") | (
            User.objects.filter(email__startswith=LEGACY_EMAIL_PREFIX)
        )
        real_hires = Hire.objects.exclude(hirer__in=demo_or_legacy).count()
        if real_hires:
            raise CommandError(
                f"Refusing to seed: {real_hires} hire(s) belong to non-demo accounts. "
                "This command writes settled payment records and must only run on a "
                "system with no real transactions."
            )

    # --- clear --------------------------------------------------------------
    def _clear(self, *, confirmed: bool) -> None:
        from accounts.models import User
        from hires.models import AvailabilityBlock, HandoverRecord, Hire, HireEvent
        from listings.models import Listing, ListingPhoto, Report, Unit
        from messaging.models import Conversation, Message
        from payments.models import Payment, Payout, Refund
        from suppliers.models import SupplierProfile, Yard

        users = User.objects.filter(email__endswith=f"@{DEMO_EMAIL_DOMAIN}") | User.objects.filter(
            email__startswith=LEGACY_EMAIL_PREFIX
        )
        user_ids = list(users.values_list("id", flat=True))
        if not user_ids:
            self.stdout.write("Nothing to clear.")
            return

        listings = Listing.objects.filter(supplier_id__in=user_ids)
        hires = Hire.objects.filter(hirer_id__in=user_ids) | Hire.objects.filter(
            supplier_id__in=user_ids
        )
        if not confirmed:
            answer = input(
                f"Delete {len(user_ids)} demo users, {listings.count()} listings and "
                f"{hires.count()} hires? [y/N] "
            )
            if answer.strip().lower() not in ("y", "yes"):
                self.stdout.write("Aborted.")
                return

        with transaction.atomic():
            hire_ids = list(hires.values_list("id", flat=True))
            # PROTECT chains: money and events must go before the hire, the hire
            # before the listing, the listing before the yard, and photos are
            # unlinked from object storage before their row disappears.
            Payout.objects.filter(hire_id__in=hire_ids).delete()
            Refund.objects.filter(hire_id__in=hire_ids).delete()
            # PaymentEvent is the standalone webhook dedup log — no hire FK, and
            # the seeder never writes one, so there is nothing to clean up there.
            Payment.objects.filter(hire_id__in=hire_ids).delete()
            HandoverRecord.objects.filter(hire_id__in=hire_ids).delete()
            HireEvent.objects.filter(hire_id__in=hire_ids).delete()
            Hire.objects.filter(id__in=hire_ids).delete()

            Message.objects.filter(conversation__supplier_id__in=user_ids).delete()
            Message.objects.filter(conversation__hirer_id__in=user_ids).delete()
            Conversation.objects.filter(supplier_id__in=user_ids).delete()
            Conversation.objects.filter(hirer_id__in=user_ids).delete()

            listing_ids = list(listings.values_list("id", flat=True))
            self._delete_photo_objects(listing_ids)
            ListingPhoto.objects.filter(listing_id__in=listing_ids).delete()
            Unit.objects.filter(listing_id__in=listing_ids).delete()
            Report.objects.filter(listing_id__in=listing_ids).delete()
            AvailabilityBlock.objects.filter(listing_id__in=listing_ids).delete()
            Listing.objects.filter(id__in=listing_ids).delete()

            Yard.objects.filter(supplier_id__in=user_ids).delete()
            SupplierProfile.objects.filter(user_id__in=user_ids).delete()
            User.objects.filter(id__in=user_ids).delete()

        self.stdout.write(self.style.WARNING(f"Cleared demo data ({len(user_ids)} accounts)."))

    def _delete_photo_objects(self, listing_ids: list) -> None:
        """Best-effort removal of the uploaded objects behind the photo rows."""
        from core import media
        from listings.models import ListingPhoto

        for key in ListingPhoto.objects.filter(listing_id__in=listing_ids).values_list(
            "r2_key", flat=True
        ):
            try:
                media.delete_public_file(key)
            except Exception:  # noqa: BLE001 — orphaned bytes never block the clear
                self.stderr.write(f"  could not delete object {key}")

    # --- seed ---------------------------------------------------------------
    def _seed(self, password: str) -> dict:
        photos = _PhotoPool(
            self,
            enabled=not self.opts["no_photos"],
            local_dir=self.opts["photos_dir"],
        )
        counts = {"suppliers": 0, "yards": 0, "listings": 0, "photos": 0, "hirers": 0}

        listings_by_ref: dict[str, object] = {}
        suppliers_by_slug: dict[str, object] = {}

        for entry in SUPPLIERS:
            with transaction.atomic():
                user = self._supplier(entry, password)
                suppliers_by_slug[entry["slug"]] = user
                yards = [self._yard(user, y) for y in entry["yards"]]
                counts["suppliers"] += 1
                counts["yards"] += len(yards)
            for spec in entry["listings"]:
                listing, n = self._listing(user, spec, yard=yards[spec["yard"]], photos=photos)
                listings_by_ref[spec["ref"]] = listing
                counts["listings"] += 1
                counts["photos"] += n
            self.stdout.write(f"  supplier: {entry['business_name']}")

        for spec in SOLO_LISTINGS:
            listing, n = self._listing(
                suppliers_by_slug[spec["supplier"]], spec, yard=None, photos=photos
            )
            listings_by_ref[spec["ref"]] = listing
            counts["listings"] += 1
            counts["photos"] += n
        self.stdout.write(f"  {len(SOLO_LISTINGS)} solo listings placed")

        hirers_by_slug = {}
        for entry in HIRERS:
            hirers_by_slug[entry["slug"]] = self._hirer(entry, password)
            counts["hirers"] += 1

        counts.update(self._hire_history(listings_by_ref, hirers_by_slug))
        return counts

    def _supplier(self, entry: dict, password: str):
        from accounts.models import AccountLevel, User
        from suppliers.models import SupplierProfile

        now = timezone.now()
        user, _ = User.objects.get_or_create(
            email=f"{entry['slug']}@{DEMO_EMAIL_DOMAIN}",
            defaults={
                "full_name": entry["contact_name"],
                "phone": entry["phone"],
                "is_supplier": True,
                "is_hirer": False,
                # Business-verified is what Ops grants after reviewing documents;
                # the seeder states it outright rather than faking a review queue.
                "account_level": AccountLevel.BUSINESS_VERIFIED,
                "phone_verified_at": now,
                "email_verified_at": now,
            },
        )
        user.set_password(password)
        user.save(update_fields=["password"])
        SupplierProfile.objects.update_or_create(
            user=user,
            defaults={
                "business_name": entry["business_name"],
                "description": entry["description"],
                "bank_name": entry["bank_name"],
                "bank_account_number_enc": "0123456789",
                "bank_account_name": entry["business_name"][:200],
            },
        )
        return user

    def _yard(self, user, spec: dict):
        from suppliers.models import Yard

        yard, _ = Yard.objects.get_or_create(
            supplier=user,
            name=spec["name"],
            defaults={
                "point": Point(spec["lng"], spec["lat"], srid=4326),
                "address_text": spec["address"],
                "city": spec["city"],
            },
        )
        return yard

    def _listing(self, user, spec: dict, *, yard, photos: _PhotoPool):
        """Create the listing, attach its photos, then publish through the gates."""
        from listings import state
        from listings.enums import ListingStatus
        from listings.models import Listing, ListingPhoto

        existing = Listing.objects.filter(supplier=user, title=spec["title"]).first()
        if existing:
            return existing, 0

        point = yard.point if yard is not None else Point(spec["lng"], spec["lat"], srid=4326)
        listing = Listing.objects.create(
            supplier=user,
            yard=yard,
            asset_class=spec["asset_class"],
            asset_type=spec["asset_type"],
            title=spec["title"],
            description=spec["description"],
            specs=spec["specs"],
            daily_price=spec["daily_price"],
            weekly_price=spec.get("weekly_price"),
            monthly_price=spec.get("monthly_price"),
            unit_count=spec.get("unit_count", 1),
            point=point,
            address_text=yard.address_text if yard is not None else spec.get("address", ""),
            city=yard.city if yard is not None else spec.get("city", ""),
            status=ListingStatus.DRAFT,
        )

        attached = 0
        for position, key in enumerate(photos.take(spec["photo"])):
            ListingPhoto.objects.create(
                listing=listing, r2_key=key, position=position, is_cover=position == 0
            )
            attached += 1

        if attached:
            state.apply(listing, "publish")
        return listing, attached

    def _hirer(self, entry: dict, password: str):
        from accounts.models import AccountLevel, User

        now = timezone.now()
        user, _ = User.objects.get_or_create(
            email=f"{entry['slug']}@{DEMO_EMAIL_DOMAIN}",
            defaults={
                "full_name": entry["name"],
                "phone": entry["phone"],
                "is_supplier": False,
                "is_hirer": True,
                # Verified so the ₦250,000 Basic cap doesn't block realistic hires.
                "account_level": AccountLevel.VERIFIED,
                "phone_verified_at": now,
                "email_verified_at": now,
            },
        )
        user.set_password(password)
        user.save(update_fields=["password"])
        return user

    # --- hire history -------------------------------------------------------
    def _hire_history(self, listings: dict, hirers: dict) -> dict:
        from hires.enums import HireStatus
        from messaging import services as messaging_services

        today = timezone.localdate()
        counts = {"hires": 0, "conversations": 0, "messages": 0}

        for item in HIRE_SCRIPT:
            listing = listings.get(item["listing"])
            hirer = hirers.get(item["hirer"])
            if listing is None or hirer is None:
                self.stderr.write(f"  skip hire: unknown ref {item['listing']}")
                continue
            supplier = listing.supplier

            if item["status"] == "enquiry":
                conversation = messaging_services.create_enquiry(user=hirer, listing_id=listing.id)
                counts["conversations"] += 1
                counts["messages"] += self._messages(
                    conversation, hirer, supplier, item["messages"]
                )
                continue

            # One transaction per hire: ``state.apply`` takes SELECT FOR UPDATE on
            # the listing row, so the whole walk has to happen inside one. Keeping
            # it per-hire means a single bad scenario rolls back alone.
            try:
                with transaction.atomic():
                    hire = self._walk_hire(item, listing, hirer, supplier, today)
            except Exception as exc:  # noqa: BLE001 — a clashing date skips one hire
                self.stderr.write(f"  skip hire on {item['listing']}: {exc}")
                continue
            counts["hires"] += 1

            # Acceptance auto-creates the hire conversation; enquiry-stage hires
            # (requested / declined) still need somewhere for the thread to live.
            conversation = None
            if hire.status not in (HireStatus.REQUESTED, HireStatus.DECLINED):
                from messaging.models import Conversation

                conversation = Conversation.objects.filter(hire=hire).first()
            if conversation is None:
                conversation = messaging_services.create_enquiry(user=hirer, listing_id=listing.id)
            counts["conversations"] += 1
            counts["messages"] += self._messages(
                conversation, hirer, supplier, item.get("messages", [])
            )

        return counts

    def _walk_hire(self, item: dict, listing, hirer, supplier, today):
        """Create the hire and walk it to ``item['status']`` through the machine.

        Must be called inside a transaction — ``state.apply`` locks the listing
        row on the capacity-consuming transitions.
        """
        from hires import services as hire_services
        from hires import state
        from hires.enums import ActorKind, CancelledBy

        hire = hire_services.create_hire(
            user=hirer,
            listing_id=listing.id,
            start_date=today + dt.timedelta(days=item["start"]),
            end_date=today + dt.timedelta(days=item["start"] + item["days"] - 1),
            hirer_note=item.get("note", ""),
        )
        target = item["status"]

        if target == "requested":
            return hire
        if target == "declined":
            state.apply(
                hire,
                "decline",
                actor=supplier,
                actor_kind=str(ActorKind.USER),
                reason=item.get("decline_reason", "Not available for those dates."),
            )
            return hire

        state.apply(hire, "accept", actor=supplier, actor_kind=str(ActorKind.USER))
        if target == "accepted":
            return hire
        if target == "cancelled":
            # Cancelled from Accepted, i.e. before payment. Cancelling a Confirmed
            # hire would owe a §7.6 refund, and the seeder must not mint refund
            # records against money that was never really collected.
            state.apply(
                hire,
                "cancel",
                actor=hirer,
                actor_kind=str(ActorKind.USER),
                cancelled_by=str(CancelledBy.HIRER),
                reason=item.get("cancel_reason", "Plans changed."),
            )
            return hire

        state.apply(hire, "pay", actor=None, actor_kind=str(ActorKind.SYSTEM))
        self._settle_payment(hire)
        if target == "confirmed":
            return hire

        state.apply(hire, "start", actor=supplier, actor_kind=str(ActorKind.USER))
        if target == "on_hire":
            return hire

        state.apply(hire, "complete", actor=supplier, actor_kind=str(ActorKind.USER))
        self._payout(hire)
        if target == "in_dispute":
            state.apply(
                hire,
                "dispute",
                actor=hirer,
                actor_kind=str(ActorKind.USER),
                reason=item.get("dispute_reason", "Service not as described."),
            )
            self._freeze_payouts(hire)
        return hire

    def _messages(self, conversation, hirer, supplier, bodies: list[str]) -> int:
        """Write the thread, alternating hirer → supplier from the first line."""
        from messaging import services as messaging_services

        sent = 0
        for n, body in enumerate(bodies):
            author = hirer if n % 2 == 0 else supplier
            try:
                messaging_services.send_message(
                    user=author, conversation_id=conversation.id, body=body
                )
                sent += 1
            except Exception as exc:  # noqa: BLE001 — one bad line never stops the seed
                self.stderr.write(f"  message skipped: {exc}")
        return sent

    def _settle_payment(self, hire) -> None:
        """Record the collection as a settled demo payment (no provider call)."""
        from payments.enums import PaymentState
        from payments.models import Payment

        Payment.objects.get_or_create(
            hire=hire,
            defaults={
                "reference": f"demo-{hire.id}",
                "charge_id": f"demo_charge_{str(hire.id)[:8]}",
                "amount": hire.hire_value,
                "state": PaymentState.SUCCESS,
                "channel": "card",
                "paid_at": timezone.now(),
            },
        )

    def _payout(self, hire) -> None:
        from payments import services as payments_services

        payments_services.create_completion_payout(hire)

    def _freeze_payouts(self, hire) -> None:
        from payments import services as payments_services

        payments_services.freeze_payouts(hire)

    # --- output -------------------------------------------------------------
    def _report(self, counts: dict, password: str, *, generated: bool) -> None:
        self.stdout.write(
            self.style.SUCCESS(
                "\nSeeded {suppliers} suppliers · {yards} yards · {listings} listings "
                "({photos} photos) · {hirers} hirers · {hires} hires · "
                "{conversations} conversations ({messages} messages).".format(**counts)
            )
        )
        example_supplier = SUPPLIERS[0]["slug"]
        example_hirer = HIRERS[0]["slug"]
        self.stdout.write(
            f"Sign in as a supplier: {example_supplier}@{DEMO_EMAIL_DOMAIN}\n"
            f"Sign in as a hirer:    {example_hirer}@{DEMO_EMAIL_DOMAIN}"
        )
        if generated:
            self.stdout.write(self.style.WARNING(f"Generated password: {password}"))
            self.stdout.write("Re-run with --password to choose your own; it is not stored.")


class _PhotoPool:
    """Supplies stored photo objects for a listing, rotating within each pool.

    Bytes are fetched once per source image and uploaded to the public bucket via
    ``core.media``; rotation means two listings of the same asset type never open
    with the same cover shot.
    """

    def __init__(self, command: Command, *, enabled: bool, local_dir: str) -> None:
        self.command = command
        self.enabled = enabled
        self.local_dir = Path(local_dir) if local_dir else None
        self.cursor: dict[str, int] = {}
        self.stored: dict[str, str] = {}  # source id -> object key (fetch once)
        self.manifest: dict[str, list[dict]] = {}
        if enabled:
            if not PHOTO_MANIFEST.exists():
                raise CommandError(f"Photo manifest missing: {PHOTO_MANIFEST}")
            self.manifest = json.loads(PHOTO_MANIFEST.read_text())

    def take(self, pool_name: str, count: int = 3) -> list[str]:
        """Object keys for the next ``count`` photos in ``pool_name``."""
        if not self.enabled:
            return []
        entries = self.manifest.get(pool_name) or []
        if not entries:
            self.command.stderr.write(f"  no photos for pool {pool_name!r}")
            return []
        start = self.cursor.get(pool_name, 0)
        self.cursor[pool_name] = start + 1
        keys = []
        for offset in range(min(count, len(entries))):
            entry = entries[(start + offset) % len(entries)]
            key = self._store(entry)
            if key:
                keys.append(key)
        return keys

    def _store(self, entry: dict) -> str | None:
        source_id = entry["id"]
        if source_id in self.stored:
            return self.stored[source_id]
        content = self._read(entry)
        if content is None:
            return None
        if len(content) > MAX_PHOTO_BYTES:
            self.command.stderr.write(f"  photo too large, skipped: {source_id}")
            return None

        from core import media
        from core.ids import uuid7

        key = f"listings/{uuid7()}.jpg"
        media.store_public_file(key, content, "image/jpeg")
        self.stored[source_id] = key
        return key

    def _read(self, entry: dict) -> bytes | None:
        if self.local_dir is not None:
            path = self.local_dir / f"{entry['id']}.jpg"
            if path.exists():
                return path.read_bytes()
            self.command.stderr.write(f"  missing local photo {path}")
            return None
        # Most sources sit behind Wikimedia/Flickr, which throttle hard. Fetch
        # serially with a courtesy pause and exponential backoff on 429/503
        # rather than hammering and losing half the photo set.
        delay = 2.0
        for attempt in range(4):
            request = urllib.request.Request(entry["url"], headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(request, timeout=PHOTO_TIMEOUT) as response:
                    content = response.read()
                time.sleep(0.4)
                return content
            except urllib.error.HTTPError as exc:
                if exc.code not in (429, 503) or attempt == 3:
                    self.command.stderr.write(f"  photo fetch failed ({entry['id']}): {exc}")
                    return None
                time.sleep(delay)
                delay *= 2
            except (urllib.error.URLError, TimeoutError) as exc:
                self.command.stderr.write(f"  photo fetch failed ({entry['id']}): {exc}")
                return None
        return None


class _notifications_muted:
    """Suppress hire notifications while seeding.

    Demo accounts sit on a reserved-invalid domain, so every notification would
    be an undeliverable send against the real Resend account. Transitions still
    run and still write their events — only the outbound dispatch is stubbed.
    """

    def __init__(self, *, enabled: bool) -> None:
        self.enabled = enabled
        self.original: Callable[..., None] | None = None

    def __enter__(self):
        if not self.enabled:
            return self
        from hires import notifications

        self.original = notifications.dispatch
        notifications.dispatch = lambda *a, **k: None
        return self

    def __exit__(self, *exc_info):
        if self.original is not None:
            from hires import notifications

            notifications.dispatch = self.original
        return False
