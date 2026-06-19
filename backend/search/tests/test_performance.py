"""Search performance guardrails (Wave 3 §3.5).

Latency (P95 < 500ms) is measured out-of-band and recorded in the PR — wall
times are too noisy to gate in CI. What we *can* gate is the shape of the work:
the query count must stay **constant regardless of dataset size** (no N+1), so
a viewport with hundreds of listings costs the same handful of queries as one
with a dozen. Also smoke-tests the dual-corridor demo seeder.
"""

from __future__ import annotations

import pytest
from django.core.management import call_command

from accounts.models import User
from listings.enums import ListingStatus
from listings.models import Listing

pytestmark = pytest.mark.django_db

MAP = "/api/v1/search/map"
LIST = "/api/v1/search/list"
# Covers both seeded corridors (Apapa + Lekki).
CORRIDOR_BBOX = "3.30,6.38,3.56,6.52"


@pytest.fixture
def seeded():
    call_command("seed_search_demo", listings=150, suppliers=6, yards=10, verbosity=0)


def test_seed_command_creates_live_dual_corridor_data(db):
    call_command("seed_search_demo", listings=40, suppliers=3, yards=4, verbosity=0)
    assert Listing.objects.filter(status=ListingStatus.LIVE).count() == 40
    assert User.objects.filter(email__startswith="search-demo-").count() == 3


def test_seed_command_clear_removes_demo_data(db):
    call_command("seed_search_demo", listings=20, suppliers=2, yards=2, verbosity=0)
    call_command("seed_search_demo", clear=True, verbosity=0)
    assert User.objects.filter(email__startswith="search-demo-").count() == 0
    assert Listing.objects.filter(status=ListingStatus.LIVE).count() == 0


def test_map_query_count_constant_at_scale(api, seeded, django_assert_max_num_queries):
    """150 listings in view cost the same query budget as a dozen (no N+1)."""
    with django_assert_max_num_queries(6):
        resp = api.get(MAP, {"bbox": CORRIDOR_BBOX})
    assert resp.status_code == 200
    body = resp.json()
    assert body["yards"] or body["listings"]  # data came back


def test_list_query_count_constant_at_scale(api, seeded, django_assert_max_num_queries):
    with django_assert_max_num_queries(6):
        resp = api.get(LIST, {"bbox": CORRIDOR_BBOX, "group_by": "location"})
    assert resp.status_code == 200
    assert resp.json()["results"]


def test_filtered_map_query_count_constant_at_scale(api, seeded, django_assert_max_num_queries):
    with django_assert_max_num_queries(6):
        resp = api.get(
            MAP, {"bbox": CORRIDOR_BBOX, "asset_class": "plant_machinery", "spec_min": 10}
        )
    assert resp.status_code == 200
