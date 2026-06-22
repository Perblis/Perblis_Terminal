"""The Ops Console dashboard renders on the admin landing page (wave-6 §6.2)."""

from __future__ import annotations

import pytest

from accounts.factories import UserFactory
from ops.admin_site import OpsAdminSite

pytestmark = pytest.mark.django_db


def test_index_injects_dashboard_context(rf):
    """OpsAdminSite.index attaches the metrics dict to the template context."""
    request = rf.get("/admin/")
    request.user = UserFactory(staff=True)
    response = OpsAdminSite().index(request)
    assert "ops_dashboard" in response.context_data
    assert response.context_data["ops_dashboard"]["gmv_display"].startswith("₦")


def test_dashboard_renders_on_admin_index(client):
    """End-to-end: a staff user sees the dashboard headings on /admin/ (2FA off in test)."""
    staff = UserFactory(staff=True)
    client.force_login(staff)
    response = client.get("/admin/")
    assert response.status_code == 200
    body = response.content.decode()
    assert "GMV (collected)" in body
    assert "Payout liability" in body
    assert "Hires by state" in body
