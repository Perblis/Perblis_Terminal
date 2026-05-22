from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from django.db.models import Count
from unfold.admin import ModelAdmin

from .models import Listing, ListingMedia, ListingReport


class HighReportCountFilter(admin.SimpleListFilter):
    title = 'report priority'
    parameter_name = 'priority'

    def lookups(self, request, model_admin):
        return [('high', 'High priority (3+ reports on listing)')]

    def queryset(self, request, queryset):
        if self.value() == 'high':
            high_report_listings = Listing.objects.annotate(
                report_total=Count('reports')
            ).filter(report_total__gte=3).values_list('id', flat=True)
            return queryset.filter(listing_id__in=high_report_listings)
        return queryset


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
    list_display = ['listing', 'reporter', 'reason', 'status', 'listing_report_count', 'created_at']
    list_filter = ['status', 'reason', HighReportCountFilter]
    search_fields = ['listing__title', 'reporter__email']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']

    actions = ['mark_reviewed', 'dismiss_reports', 'warn_owner', 'remove_listing']

    def listing_report_count(self, obj):
        return obj.listing.reports.count()
    listing_report_count.short_description = 'Reports on listing'

    @admin.action(description='Mark selected reports as reviewed')
    def mark_reviewed(self, request, queryset):
        queryset.update(status='reviewed')

    @admin.action(description='Dismiss selected reports')
    def dismiss_reports(self, request, queryset):
        queryset.update(status='dismissed')

    @admin.action(description='Warn owner (mark reviewed + message)')
    def warn_owner(self, request, queryset):
        count = 0
        for report in queryset.filter(status='pending'):
            report.status = 'reviewed'
            report.save()
            count += 1
        self.message_user(request, f'{count} report(s) marked as reviewed. Owners should be warned manually.')

    @admin.action(description='Remove reported listing (set removed_by_admin)')
    def remove_listing(self, request, queryset):
        listing_ids = set()
        for report in queryset:
            report.status = 'reviewed'
            report.save()
            listing_ids.add(report.listing_id)
        removed = Listing.objects.filter(id__in=listing_ids).update(status='removed_by_admin')
        self.message_user(request, f'{removed} listing(s) removed by admin. {len(listing_ids)} report(s) marked reviewed.')
