import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    username = None
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True)

    objects = UserManager()

    profile_photo = models.ImageField(upload_to='profiles/', blank=True, null=True)
    bio = models.TextField(blank=True, default='')

    is_renter = models.BooleanField(default=True)
    is_owner = models.BooleanField(default=False)

    verification_level = models.IntegerField(default=0)
    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    is_id_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['phone', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    @property
    def full_name(self):
        return self.get_full_name()


class OTPCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_codes')
    code = models.CharField(max_length=6)

    OTP_TYPE_PHONE = 'phone_verification'
    OTP_TYPE_PASSWORD_RESET = 'password_reset'
    OTP_TYPES = [
        (OTP_TYPE_PHONE, 'Phone Verification'),
        (OTP_TYPE_PASSWORD_RESET, 'Password Reset'),
    ]
    otp_type = models.CharField(max_length=30, choices=OTP_TYPES)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'otp_codes'
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP({self.otp_type}) for {self.user.email}"


class UserDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    document_file = models.FileField(upload_to='kyc_documents/')

    DOC_TYPE_GOVERNMENT_ID = 'government_id'
    DOC_TYPE_BUSINESS_REG = 'business_registration'
    DOC_TYPES = [
        (DOC_TYPE_GOVERNMENT_ID, 'Government ID'),
        (DOC_TYPE_BUSINESS_REG, 'Business Registration'),
    ]
    document_type = models.CharField(max_length=30, choices=DOC_TYPES)

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.document_type} for {self.user.email} — {self.status}"


class OwnerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='owner_profile',
    )

    business_name = models.CharField(max_length=200, blank=True, default='')
    business_description = models.TextField(blank=True, default='')
    business_logo = models.ImageField(upload_to='business_logos/', blank=True, null=True)

    bank_name = models.CharField(max_length=100, blank=True, default='')
    bank_account_number = models.CharField(max_length=20, blank=True, default='')
    bank_account_name = models.CharField(max_length=200, blank=True, default='')

    notify_new_booking_request = models.BooleanField(default=True)
    notify_booking_confirmed = models.BooleanField(default=True)
    notify_new_message = models.BooleanField(default=True)
    notify_booking_cancelled = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'owner_profiles'

    def __str__(self):
        return f"OwnerProfile: {self.user.email}"
