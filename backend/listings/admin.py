"""Django admin for listings — the Ops moderation surface (wave-6 §6.5)."""

from __future__ import annotations

from django import forms
from django.contrib import admin, messages
from django.template.response import TemplateResponse

from listings.enums import ListingTier, ReportState
from listings.errors import InvalidTransition
from listings.models import Listing, Report, SpecTemplate, Unit
from listings.services import moderation
from listings.services.reports import resolve_report


@admin.register(SpecTemplate)
class SpecTemplateAdmin(admin.ModelAdmin):
    list_display = ("asset_class", "asset_type", "version")
    list_filter = ("asset_class",)
    search_fields = ("asset_type",)


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 0


class RemoveReasonForm(forms.Form):
    reason = forms.CharField(
        widget=forms.Textarea, label="Removal reason (required, sent to supplier)"
    )


class AwardTierForm(forms.Form):
    tier = forms.ChoiceField(
        choices=[
            (t, t.label) for t in (ListingTier.BASIC, ListingTier.VERIFIED, ListingTier.INSPECTED)
        ],
        label="Award tier",
    )


def _action_form(model_admin, request, queryset, form, action_name, title, submit_label):
    return TemplateResponse(
        request,
        "admin/listings/reason_action.html",
        {
            "title": title,
            "queryset": queryset,
            "form": form,
            "action_name": action_name,
            "submit_label": submit_label,
            "opts": model_admin.model._meta,
        },
    )


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "supplier",
        "asset_class",
        "asset_type",
        "status",
        "tier",
        "priority_review_flag",
        "report_count",
        "created_at",
    )
    list_filter = ("status", "tier", "asset_class", "priority_review_flag")
    search_fields = ("title", "supplier__email", "asset_type")
    readonly_fields = (
        "completeness_score",
        "report_count",
        "priority_review_flag",
        "removed_reason",
    )
    inlines = [UnitInline]
    actions = ("pause_listings", "remove_listings", "award_tier")

    @admin.action(description="Pause selected (Live → Paused)")
    def pause_listings(self, request, queryset):
        done = 0
        for listing in queryset:
            try:
                moderation.pause_listing(listing)
                done += 1
            except InvalidTransition:
                self.message_user(
                    request,
                    f"{listing.title}: cannot pause from {listing.status}.",
                    messages.WARNING,
                )
        self.message_user(request, f"Paused {done} listing(s).", messages.SUCCESS)

    @admin.action(description="Remove selected (requires a reason, notifies supplier)")
    def remove_listings(self, request, queryset):
        if "apply" in request.POST:
            form = RemoveReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                done = 0
                for listing in queryset:
                    try:
                        moderation.remove_listing(listing, reason=reason)
                        done += 1
                    except InvalidTransition:
                        self.message_user(
                            request,
                            f"{listing.title}: cannot remove from {listing.status}.",
                            messages.WARNING,
                        )
                self.message_user(request, f"Removed {done} listing(s).", messages.SUCCESS)
                return None
        else:
            form = RemoveReasonForm()
        return _action_form(
            self, request, queryset, form, "remove_listings", "Remove listings", "Remove"
        )

    @admin.action(description="Award trust tier")
    def award_tier(self, request, queryset):
        if "apply" in request.POST:
            form = AwardTierForm(request.POST)
            if form.is_valid():
                tier = form.cleaned_data["tier"]
                for listing in queryset:
                    moderation.award_tier(listing, tier=tier)
                self.message_user(
                    request,
                    f"Awarded {tier} to {queryset.count()} listing(s).",
                    messages.SUCCESS,
                )
                return None
        else:
            form = AwardTierForm()
        return _action_form(
            self, request, queryset, form, "award_tier", "Award trust tier", "Award"
        )


class ReportNoteForm(forms.Form):
    note = forms.CharField(widget=forms.Textarea, label="Resolution note / reason")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("listing", "reason", "state", "reporter", "created_at")
    list_filter = ("state", "reason")
    search_fields = ("listing__title", "listing__supplier__email", "reporter__email")
    readonly_fields = (
        "listing",
        "reporter",
        "reason",
        "note",
        "state",
        "resolution_note",
        "created_at",
        "sibling_listings",
    )
    actions = ("resolve_dismiss", "resolve_warn", "resolve_remove")

    @admin.display(description="Supplier's other listings")
    def sibling_listings(self, obj: Report) -> str:
        siblings = Listing.objects.filter(supplier=obj.listing.supplier).exclude(id=obj.listing_id)
        return ", ".join(f"{listing.title} ({listing.status})" for listing in siblings) or "—"

    @admin.action(description="Dismiss selected")
    def resolve_dismiss(self, request, queryset):
        done = 0
        for report in queryset.filter(state=ReportState.OPEN):
            resolve_report(report, outcome=ReportState.DISMISSED)
            done += 1
        self.message_user(request, f"Dismissed {done} report(s).", messages.SUCCESS)

    @admin.action(description="Warn supplier (note → email)")
    def resolve_warn(self, request, queryset):
        return self._resolve_with_note(
            request, queryset, ReportState.WARNED, "resolve_warn", "Warn supplier", "Warn"
        )

    @admin.action(description="Remove listing (reason required, notifies supplier)")
    def resolve_remove(self, request, queryset):
        return self._resolve_with_note(
            request, queryset, ReportState.REMOVED, "resolve_remove", "Remove via report", "Remove"
        )

    def _resolve_with_note(self, request, queryset, outcome, action_name, title, submit_label):
        open_reports = queryset.filter(state=ReportState.OPEN)
        if "apply" in request.POST:
            form = ReportNoteForm(request.POST)
            if form.is_valid():
                note = form.cleaned_data["note"]
                done = 0
                for report in open_reports:
                    try:
                        resolve_report(report, outcome=outcome, note=note)
                        done += 1
                    except InvalidTransition as exc:
                        self.message_user(request, str(exc), messages.WARNING)
                self.message_user(request, f"Resolved {done} report(s).", messages.SUCCESS)
                return None
        else:
            form = ReportNoteForm()
        return _action_form(self, request, open_reports, form, action_name, title, submit_label)
