"""Django admin for suppliers (Ops surface).

The bank account number is never shown — only its masked form — even to Ops.
"""

from __future__ import annotations

from django.contrib import admin

from suppliers.models import SupplierProfile, Yard


@admin.register(SupplierProfile)
class SupplierProfileAdmin(admin.ModelAdmin):
    list_display = ("business_name", "user", "bank_name", "strike_count", "created_at")
    search_fields = ("business_name", "user__email", "bank_name")
    readonly_fields = (
        "user",
        "masked_bank_account_number",
        "is_complete",
        "created_at",
        "updated_at",
    )
    exclude = ("bank_account_number_enc",)

    @admin.display(description="Bank account number")
    def masked_bank_account_number(self, obj: SupplierProfile) -> str:
        return obj.masked_bank_account_number


@admin.register(Yard)
class YardAdmin(admin.ModelAdmin):
    list_display = ("name", "supplier", "city", "created_at")
    search_fields = ("name", "city", "supplier__email")
