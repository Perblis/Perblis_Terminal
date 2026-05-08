from django.urls import path
from . import views

urlpatterns = [
    path('', views.booking_list_create, name='booking-list-create'),
    path('<uuid:booking_id>/', views.booking_detail, name='booking-detail'),
    path('<uuid:booking_id>/accept/', views.booking_accept, name='booking-accept'),
    path('<uuid:booking_id>/decline/', views.booking_decline, name='booking-decline'),
    path('<uuid:booking_id>/cancel/', views.booking_cancel, name='booking-cancel'),
    path('<uuid:booking_id>/pay/', views.booking_mark_paid, name='booking-mark-paid'),
]
