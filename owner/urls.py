from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('dashboard/', views.owner_dashboard, name='owner-dashboard'),

    # Booking calendar
    path('bookings/calendar/', views.booking_calendar, name='owner-booking-calendar'),

    # Analytics
    path('analytics/revenue/', views.analytics_revenue, name='owner-analytics-revenue'),
    path('analytics/performance/', views.analytics_performance, name='owner-analytics-performance'),

    # Listing utilities
    path('listings/<uuid:listing_id>/stats/', views.listing_stats, name='owner-listing-stats'),
    path('listings/<uuid:listing_id>/duplicate/', views.duplicate_listing, name='owner-listing-duplicate'),
    path('listings/bulk/', views.bulk_listing_action, name='owner-listing-bulk'),

    # Settings
    path('business-profile/', views.business_profile, name='owner-business-profile'),
    path('bank-account/', views.bank_account, name='owner-bank-account'),
    path('notifications/', views.notification_preferences, name='owner-notifications'),
]
