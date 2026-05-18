from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from unfold.admin import ModelAdmin

from .models import Listing, ListingMedia, ListingReport


class ListingMediaInline(admin.TabularInline):
    model = ListingMedia
    extra = 0
    readonly_fields = ['id', 'created_at']


@admin.register(Listing)
class ListingAdmin(GISModelAdmin, ModelAdmin):
    list_display = [
        'title', 'resource_type', 'owner', 'location_city',
        'status', 'is_available', 'verification_tier', 'view_count', 'created_at',
    ]
    list_filter = ['resource_type', 'status', 'is_available', 'verification_tier']
    search_fields = ['title', 'owner__email', 'location_city']
    readonly_fields = ['id', 'view_count', 'created_at', 'updated_at']
    inlines = [ListingMediaInline]
    ordering = ['-created_at']

    actions = ['activate_listings', 'pause_listings', 'archive_listings', 'remove_listings']

    @admin.action(description='Activate selected listings')
    def activate_listings(self, request, queryset):
        queryset.filter(location__isnull=False).update(status='active')

    @admin.action(description='Pause selected listings')
    def pause_listings(self, request, queryset):
        queryset.update(status='paused')

    @admin.action(description='Archive selected listings')
    def archive_listings(self, request, queryset):
        queryset.update(status='archived')

    @admin.action(description='Remove selected listings (admin action)')
    def remove_listings(self, request, queryset):
        count = queryset.update(status='removed_by_admin')
        self.message_user(request, f'{count} listing(s) removed by admin.')


@admin.register(ListingReport)
class ListingReportAdmin(ModelAdmin):
    list_display = ['listing', 'reporter', 'reason', 'status', 'created_at']
    list_filter = ['reason', 'status']
    search_fields = ['listing__title', 'reporter__email']
    readonly_fields = ['id', 'created_at']

    actions = ['mark_reviewed', 'dismiss_reports']

    @admin.action(description='Mark selected reports as reviewed')
    def mark_reviewed(self, request, queryset):
        queryset.update(status='reviewed')

    @admin.action(description='Dismiss selected reports')
    def dismiss_reports(self, request, queryset):
        queryset.update(status='dismissed')
