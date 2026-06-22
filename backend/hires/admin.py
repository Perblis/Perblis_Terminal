"""Ops Console hires admin & dispute resolution (wave-6 §6.6).

Read-mostly: the full event timeline, both parties, financials (Ops sees the
fee — this is not a hirer surface, so D-014 doesn't apply here), the linked
payment/refund/payout records, the read-only conversation (dispute context,
FSD §8 — Ops sees the original message bodies), and the per-hire money
invariant. Mutations (resolve dispute, admin cancel) flow through the hire
state machine via the existing services — no parallel write paths.
"""

from __future__ import annotations

from django import forms
from django.contrib import admin, messages
from django.template.response import TemplateResponse
from django.utils.html import format_html, format_html_join

from core.money import display
from hires import services
from hires.enums import HireStatus
from hires.models import Hire, HireEvent
from payments.enums import PayoutState
from payments.models import Payment, Payout, Refund
from payments.services import retained


class ReasonForm(forms.Form):
    reason = forms.CharField(widget=forms.Textarea, label="Reason (required)")


class HireEventInline(admin.TabularInline):
    model = HireEvent
    extra = 0
    can_delete = False
    fields = ("created_at", "actor_kind", "actor", "from_status", "to_status", "meta")
    readonly_fields = fields
    ordering = ("created_at",)

    def has_add_permission(self, request, obj=None):  # append-only audit trail
        return False


class _ReadOnlyInline(admin.TabularInline):
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class PaymentInline(_ReadOnlyInline):
    model = Payment
    fields = ("reference", "amount", "state", "paid_at")
    readonly_fields = fields


class RefundInline(_ReadOnlyInline):
    model = Refund
    fields = ("amount", "state", "reason", "created_at")
    readonly_fields = fields


class PayoutInline(_ReadOnlyInline):
    model = Payout
    fields = ("amount", "kind", "state", "paid_ref", "paid_at")
    readonly_fields = fields


@admin.register(Hire)
class HireAdmin(admin.ModelAdmin):
    list_display = ("id", "listing", "hirer", "supplier", "status", "value", "created_at")
    list_filter = ("status", "scheme")
    search_fields = ("id", "hirer__email", "supplier__email", "listing__title")
    date_hierarchy = "created_at"
    inlines = [HireEventInline, PaymentInline, RefundInline, PayoutInline]
    actions = ("resolve_complete", "resolve_cancel", "admin_cancel")
    readonly_fields = (
        "listing",
        "hirer",
        "supplier",
        "status",
        "scheme",
        "fee_basis",
        "value",
        "fee",
        "payout",
        "money_invariant",
        "conversation_log",
        "created_at",
        "updated_at",
    )
    exclude = ("hire_value", "service_fee", "payout_amount")

    @admin.display(description="Hire value")
    def value(self, obj: Hire) -> str:
        return display(obj.hire_value)

    @admin.display(description="Service fee (Ops only)")
    def fee(self, obj: Hire) -> str:
        return display(obj.service_fee)

    @admin.display(description="Payout amount")
    def payout(self, obj: Hire) -> str:
        return display(obj.payout_amount)

    @admin.display(description="Money invariant (collected − refunded − paid_out − fee)")
    def money_invariant(self, obj: Hire):
        balance = retained(obj) - obj.service_fee
        text = (
            f"retained {display(retained(obj))} − fee {display(obj.service_fee)} "
            f"= {display(balance)}"
        )
        # The invariant must net to zero once a completed hire's payout has
        # SETTLED. Before then the payout amount is legitimately still retained,
        # so only flag a completed hire with no outstanding payout and a nonzero
        # balance — a genuine accounting leak.
        outstanding = obj.payouts.exclude(state=PayoutState.PAID).exists()
        if obj.status == HireStatus.COMPLETED and not outstanding and balance != 0:
            return format_html('<span style="color:#B91C1C;font-weight:600">{}</span>', text)
        return text

    @admin.display(description="Conversation (Ops dispute context — original text)")
    def conversation_log(self, obj: Hire):
        conv = getattr(obj, "conversation", None)
        if conv is None:
            return "—"
        messages_qs = conv.messages.select_related("sender").order_by("created_at")
        if not messages_qs:
            return "(no messages)"
        return format_html_join(
            "",
            "<div><strong>{}</strong>: {}</div>",
            ((m.sender.email, m.body) for m in messages_qs),
        )

    # --- dispute / cancel actions ------------------------------------------
    @admin.action(description="Resolve dispute → Completed (queues payout)")
    def resolve_complete(self, request, queryset):
        return self._resolve(
            request, queryset, "complete", "resolve_complete", "Resolve → Completed"
        )

    @admin.action(description="Resolve dispute → Cancelled (refund per §7.6)")
    def resolve_cancel(self, request, queryset):
        return self._resolve(request, queryset, "cancel", "resolve_cancel", "Resolve → Cancelled")

    @admin.action(description="Admin cancel (any non-terminal hire, reason required)")
    def admin_cancel(self, request, queryset):
        if "apply" in request.POST:
            form = ReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                done = 0
                for hire in queryset:
                    try:
                        services.cancel_hire(user=request.user, hire_id=hire.id, reason=reason)
                        self.log_change(request, hire, f"Ops: admin cancel ({reason})")
                        done += 1
                    except Exception as exc:  # surface guard failures, don't 500
                        self.message_user(request, f"{hire.id}: {exc}", messages.WARNING)
                self.message_user(request, f"Cancelled {done} hire(s).", messages.SUCCESS)
                return None
        else:
            form = ReasonForm()
        return self._form(request, queryset, form, "admin_cancel", "Admin cancel hires", "Cancel")

    def _resolve(self, request, queryset, outcome, action_name, title):
        disputed = queryset.filter(status=HireStatus.IN_DISPUTE)
        if "apply" in request.POST:
            form = ReasonForm(request.POST)
            if form.is_valid():
                reason = form.cleaned_data["reason"]
                done = 0
                for hire in disputed:
                    try:
                        services.resolve_dispute(
                            user=request.user, hire_id=hire.id, outcome=outcome, reason=reason
                        )
                        self.log_change(
                            request, hire, f"Ops: resolve dispute → {outcome} ({reason})"
                        )
                        done += 1
                    except Exception as exc:
                        self.message_user(request, f"{hire.id}: {exc}", messages.WARNING)
                self.message_user(request, f"Resolved {done} dispute(s).", messages.SUCCESS)
                return None
        else:
            form = ReasonForm()
        return self._form(request, disputed, form, action_name, title, "Resolve")

    def _form(self, request, queryset, form, action_name, title, submit_label):
        return TemplateResponse(
            request,
            "admin/hires/hire_action.html",
            {
                "title": title,
                "queryset": queryset,
                "form": form,
                "action_name": action_name,
                "submit_label": submit_label,
                "opts": self.model._meta,
            },
        )
