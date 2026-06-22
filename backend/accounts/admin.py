"""Django admin — including the minimal Ops verification queue (Wave 1).

The full Ops Console is Wave 6; this gives Ops a working review queue from day
one: pending-first list, inline presigned document links, and approve/reject
actions that go through the verification service (so level upgrades and
notifications happen exactly as in the API).
"""

from __future__ import annotations

from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.db.models import Case, IntegerField, Value, When
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from accounts.enums import VerificationState
from accounts.integrations import media
from accounts.models import User, VerificationRequest
from accounts.services import verification


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "full_name",
        "phone",
        "account_level",
        "is_supplier",
        "is_hirer",
        "is_active",
    )
    list_filter = ("account_level", "is_supplier", "is_hirer", "is_active", "is_staff")
    search_fields = ("email", "phone", "full_name")
    readonly_fields = ("created_at", "updated_at", "last_login", "purged_at")
    fieldsets = (
        (None, {"fields": ("full_name", "email", "phone", "password")}),
        ("Roles", {"fields": ("is_supplier", "is_hirer", "account_level")}),
        (
            "Status",
            {
                "fields": (
                    "is_active",
                    "phone_verified_at",
                    "email_verified_at",
                    "suspended_at",
                    "suspended_reason",
                    "deleted_at",
                    "purged_at",
                )
            },
        ),
        ("Permissions", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("full_name", "email", "phone", "password1", "password2"),
            },
        ),
    )


class RejectReasonForm(forms.Form):
    reason = forms.CharField(widget=forms.Textarea, label="Rejection reason (required)")


@admin.register(VerificationRequest)
class VerificationRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "state", "rc_number", "age", "created_at", "decided_at")
    list_filter = ("state", "kind")
    search_fields = ("user__email", "user__phone", "rc_number")
    readonly_fields = (
        "user",
        "kind",
        "rc_number",
        "state",
        "reviewer",
        "reason",
        "decided_at",
        "created_at",
        "updated_at",
        "documents",
    )
    exclude = ("doc_keys",)
    actions = ("approve_requests", "reject_requests")

    def get_queryset(self, request):
        # Pending first, then most recent.
        qs = super().get_queryset(request)
        return qs.annotate(
            _pending_first=Case(
                When(state=VerificationState.PENDING, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        ).order_by("_pending_first", "-created_at")

    @admin.display(description="Age")
    def age(self, obj: VerificationRequest):
        # SLA visibility (FSD §4.3): pending requests older than 12h are flagged.
        if obj.state != VerificationState.PENDING:
            return "—"
        hours = (timezone.now() - obj.created_at).total_seconds() / 3600
        label = f"{hours:.0f}h"
        if hours > 12:
            return format_html('<span style="color:#B91C1C;font-weight:600">{}</span>', label)
        return label

    @admin.display(description="Documents (15-min links)")
    def documents(self, obj: VerificationRequest):
        if not obj.doc_keys:
            return "—"
        return format_html_join(
            "",
            '<div><a href="{}" target="_blank" rel="noopener">{}</a></div>',
            ((media.presign_get(key), key.split("/")[-1]) for key in obj.doc_keys),
        )

    @admin.action(description="Approve selected (upgrades account, notifies user)")
    def approve_requests(self, request, queryset):
        done = 0
        for req in queryset.filter(state=VerificationState.PENDING):
            verification.approve(req, reviewer=request.user)
            done += 1
        self.message_user(request, f"Approved {done} request(s).", messages.SUCCESS)

    @admin.action(description="Reject selected (requires a reason, notifies user)")
    def reject_requests(self, request, queryset):
        pending = queryset.filter(state=VerificationState.PENDING)
        if "apply" in request.POST:
            form = RejectReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                for req in pending:
                    verification.reject(req, reviewer=request.user, reason=reason)
                self.message_user(
                    request, f"Rejected {pending.count()} request(s).", messages.SUCCESS
                )
                return None
        else:
            form = RejectReasonForm()
        return TemplateResponse(
            request,
            "admin/accounts/reject_verification.html",
            {
                "title": "Reject verification requests",
                "queryset": pending,
                "form": form,
                "action_name": "reject_requests",
                "opts": self.model._meta,
            },
        )
