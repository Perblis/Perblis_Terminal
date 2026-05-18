from django.urls import path
from . import views

urlpatterns = [
    path('', views.listing_list_create, name='listing-list-create'),
    path('<uuid:listing_id>/', views.listing_detail, name='listing-detail'),
    path('<uuid:listing_id>/status/', views.listing_status, name='listing-status'),
    path('<uuid:listing_id>/media/', views.upload_media, name='listing-upload-media'),
    path('<uuid:listing_id>/media/<uuid:media_id>/', views.delete_media, name='listing-delete-media'),
    path('<uuid:listing_id>/report/', views.report_listing, name='listing-report'),
    path('<uuid:listing_id>/availability/', views.listing_availability, name='listing-availability'),
]
