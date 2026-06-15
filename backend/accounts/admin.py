from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from accounts.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "phone", "account_level", "is_supplier", "is_hirer", "is_active")
    list_filter = ("account_level", "is_supplier", "is_hirer", "is_active", "is_staff")
    search_fields = ("email", "phone")
    readonly_fields = ("created_at", "updated_at", "last_login")
    fieldsets = (
        (None, {"fields": ("email", "phone", "password")}),
        ("Roles", {"fields": ("is_supplier", "is_hirer", "account_level")}),
        ("Status", {"fields": ("is_active", "suspended_at", "suspended_reason", "deleted_at")}),
        ("Permissions", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "phone", "password1", "password2"),
            },
        ),
    )
