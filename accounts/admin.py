from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import User, OTPCode, UserDocument, OwnerProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = [
        'email', 'full_name', 'phone', 'is_renter', 'is_owner',
        'verification_level', 'is_active', 'created_at',
    ]
    list_filter = ['is_owner', 'is_renter', 'is_active', 'verification_level']
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering = ['-created_at']

    fieldsets = (
        ('Account', {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone', 'bio', 'profile_photo')}),
        ('Roles', {'fields': ('is_renter', 'is_owner')}),
        ('Verification', {'fields': ('is_phone_verified', 'is_email_verified', 'is_id_verified', 'verification_level')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'phone', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )

    actions = ['suspend_users', 'activate_users']

    @admin.action(description='Suspend selected users')
    def suspend_users(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description='Activate selected users')
    def activate_users(self, request, queryset):
        queryset.update(is_active=True)


@admin.register(OTPCode)
class OTPCodeAdmin(ModelAdmin):
    list_display = ['user', 'otp_type', 'is_used', 'expires_at', 'created_at']
    list_filter = ['otp_type', 'is_used']
    search_fields = ['user__email']
    readonly_fields = ['id', 'code', 'created_at']


@admin.register(UserDocument)
class UserDocumentAdmin(ModelAdmin):
    list_display = ['user', 'document_type', 'status', 'created_at']
    list_filter = ['document_type', 'status']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']

    actions = ['approve_documents', 'reject_documents']

    @admin.action(description='Approve selected documents')
    def approve_documents(self, request, queryset):
        count = 0
        for doc in queryset.filter(status='pending'):
            doc.status = 'approved'
            doc.save()
            user = doc.user
            user.is_id_verified = True
            if user.verification_level < 1:
                user.verification_level = 1
            user.save(update_fields=['is_id_verified', 'verification_level'])
            count += 1
        self.message_user(request, f'{count} document(s) approved and user(s) verified.')

    @admin.action(description='Reject selected documents')
    def reject_documents(self, request, queryset):
        count = queryset.filter(status='pending').update(status='rejected')
        self.message_user(request, f'{count} document(s) rejected.')


@admin.register(OwnerProfile)
class OwnerProfileAdmin(ModelAdmin):
    list_display = ['user', 'business_name', 'bank_name', 'created_at']
    search_fields = ['user__email', 'business_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
