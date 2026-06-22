"""Ops Console payout queue (wave-6 §6.4).

The Friday payout batch: list ``due`` payouts with the supplier's bank details
(the **only** admin surface that shows the full account number — decrypted for
display here, masked everywhere else), mark them paid against a bank reference
(emails the supplier), and freeze/unfreeze with a reason. Every mutation goes
through ``payments.services`` (no parallel write paths) and Django records a
``LogEntry`` for the admin action.
"""

from __future__ import annotations

from django import forms
from django.contrib import admin, messages
from django.template.response import TemplateResponse

from core.money import display

from . import services
from .enums import PayoutState
from .errors import PayoutAlreadyPaid, PayoutFrozen
from .models import Payout


class MarkPaidForm(forms.Form):
    reference = forms.CharField(label="Bank transfer reference (required)", max_length=128)


class FreezeReasonForm(forms.Form):
    reason = forms.CharField(widget=forms.Textarea, label="Freeze reason (required)")


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ("hire", "supplier", "amount_display", "kind", "state", "created_at", "paid_at")
    list_filter = ("state", "kind", ("created_at", admin.DateFieldListFilter))
    search_fields = ("hire__id", "supplier__email")
    readonly_fields = (
        "hire",
        "supplier",
        "amount_display",
        "kind",
        "state",
        "paid_ref",
        "paid_at",
        "frozen_reason",
        "bank_details",
        "created_at",
        "updated_at",
    )
    actions = ("mark_paid", "freeze_selected", "unfreeze_selected", "sum_selected")

    def get_queryset(self, request):
        # Due payouts first (the batch work), then the rest by recency.
        from django.db.models import Case, IntegerField, Value, When

        qs = super().get_queryset(request).select_related("supplier", "hire")
        return qs.annotate(
            _due_first=Case(
                When(state=PayoutState.DUE, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        ).order_by("_due_first", "-created_at")

    @admin.display(description="Supplier bank details (payout queue only)")
    def bank_details(self, obj: Payout) -> str:
        # The one place the full account number is shown — decrypted for the
        # batch operator. Masked in SupplierProfileAdmin and every other surface.
        profile = getattr(obj.supplier, "supplier_profile", None)
        if profile is None or not profile.bank_account_number_enc:
            return "— no bank details on file —"
        return (
            f"{profile.bank_name} · {profile.bank_account_number_enc} · {profile.bank_account_name}"
        )

    # --- actions ------------------------------------------------------------
    @admin.action(description="Mark paid (records reference, emails supplier)")
    def mark_paid(self, request, queryset):
        payable = queryset.exclude(state__in=[PayoutState.PAID, PayoutState.FROZEN])
        if "apply" in request.POST:
            form = MarkPaidForm(request.POST)
            if form.is_valid():
                reference = form.cleaned_data["reference"]
                done = 0
                for payout in payable:
                    try:
                        services.mark_payout_paid(payout, reference=reference)
                        done += 1
                    except (PayoutFrozen, PayoutAlreadyPaid) as exc:
                        self.message_user(request, str(exc), messages.WARNING)
                self.message_user(request, f"Marked {done} payout(s) paid.", messages.SUCCESS)
                return None
        else:
            form = MarkPaidForm()
        return self._action_form(
            request, payable, form, "mark_paid", "Mark payouts paid", "Mark paid"
        )

    @admin.action(description="Freeze (requires a reason)")
    def freeze_selected(self, request, queryset):
        freezable = queryset.exclude(state=PayoutState.PAID)
        if "apply" in request.POST:
            form = FreezeReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                for payout in freezable:
                    services.freeze_payout(payout, reason=reason)
                self.message_user(
                    request, f"Froze {freezable.count()} payout(s).", messages.SUCCESS
                )
                return None
        else:
            form = FreezeReasonForm()
        return self._action_form(
            request, freezable, form, "freeze_selected", "Freeze payouts", "Freeze"
        )

    @admin.action(description="Unfreeze (returns to the due queue)")
    def unfreeze_selected(self, request, queryset):
        done = 0
        for payout in queryset.filter(state=PayoutState.FROZEN):
            services.unfreeze_payout(payout)
            done += 1
        self.message_user(request, f"Unfroze {done} payout(s).", messages.SUCCESS)

    @admin.action(description="Sum selected (batch total)")
    def sum_selected(self, request, queryset):
        total = sum(p.amount for p in queryset)
        self.message_user(
            request,
            f"Selected {queryset.count()} payout(s) — total {display(total)}.",
            messages.INFO,
        )

    def _action_form(self, request, queryset, form, action_name, title, submit_label):
        return TemplateResponse(
            request,
            "admin/payments/payout_action.html",
            {
                "title": title,
                "queryset": queryset,
                "form": form,
                "action_name": action_name,
                "submit_label": submit_label,
                "opts": self.model._meta,
            },
        )
