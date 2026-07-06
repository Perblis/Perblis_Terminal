"""Listings URL routes, mounted under /api/v1/ (namespace api:listings)."""

from __future__ import annotations

from django.urls import path

from listings import views

app_name = "listings"

urlpatterns = [
    path("spec-templates", views.SpecTemplateView.as_view(), name="spec-templates"),
    path("listings", views.ListingListCreateView.as_view(), name="listings"),
    path("listings/<uuid:listing_id>", views.ListingDetailView.as_view(), name="listing-detail"),
    path(
        "listings/<uuid:listing_id>/photos", views.ListingPhotoView.as_view(), name="listing-photos"
    ),
    path(
        "listings/<uuid:listing_id>/photos/<uuid:photo_id>",
        views.ListingPhotoDetailView.as_view(),
        name="listing-photo-detail",
    ),
    path(
        "listings/<uuid:listing_id>/photos/order",
        views.ListingPhotoReorderView.as_view(),
        name="listing-photos-order",
    ),
    path(
        "listings/<uuid:listing_id>/publish",
        views.ListingPublishView.as_view(),
        name="listing-publish",
    ),
    path(
        "listings/<uuid:listing_id>/pause", views.ListingPauseView.as_view(), name="listing-pause"
    ),
    path(
        "listings/<uuid:listing_id>/archive",
        views.ListingArchiveView.as_view(),
        name="listing-archive",
    ),
    path(
        "listings/<uuid:listing_id>/duplicate",
        views.ListingDuplicateView.as_view(),
        name="listing-duplicate",
    ),
    path(
        "listings/<uuid:listing_id>/reports",
        views.ListingReportView.as_view(),
        name="listing-reports",
    ),
    path("storefronts/<uuid:supplier_id>", views.StorefrontView.as_view(), name="storefront"),
]
