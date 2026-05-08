from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Thread, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ['id', 'sender', 'body', 'is_read', 'created_at']
    can_delete = False


@admin.register(Thread)
class ThreadAdmin(ModelAdmin):
    list_display = ['id', 'listing', 'booking', 'is_booking_thread', 'created_at']
    list_filter = ['created_at']
    search_fields = ['listing__title', 'participants__email']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [MessageInline]
