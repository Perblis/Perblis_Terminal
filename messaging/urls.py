from django.urls import path
from . import views

urlpatterns = [
    path('', views.thread_list_create, name='thread-list-create'),
    path('<uuid:thread_id>/', views.thread_detail, name='thread-detail'),
    path('<uuid:thread_id>/messages/', views.send_message, name='send-message'),
    path('token/', views.get_messaging_token, name='messaging-token'),
]
