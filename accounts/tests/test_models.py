import pytest
from django.contrib.auth import get_user_model
from accounts.models import OTPCode, UserDocument, OwnerProfile

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_user_uses_email_as_username(self):
        assert User.USERNAME_FIELD == 'email'

    def test_user_default_is_renter(self, create_user):
        user = create_user(email='newuser@test.com', phone='08077777771')
        assert user.is_renter is True
        assert user.is_owner is False

    def test_user_full_name(self, create_user):
        user = create_user(
            email='fullname@test.com',
            phone='08077777772',
            first_name='John',
            last_name='Doe',
        )
        assert user.full_name == 'John Doe'

    def test_user_str(self, create_user):
        user = create_user(
            email='str@test.com',
            phone='08077777773',
            first_name='Jane',
            last_name='Smith',
        )
        assert str(user) == 'Jane Smith <str@test.com>'

    def test_user_email_is_unique(self, create_user):
        create_user(email='unique@test.com', phone='08077777774')
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            create_user(email='unique@test.com', phone='08077777775')

    def test_user_phone_is_unique(self, create_user):
        create_user(email='phone1@test.com', phone='08077777776')
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            create_user(email='phone2@test.com', phone='08077777776')

    def test_owner_profile_auto_created_when_owner(self, create_user):
        user = create_user(
            email='owner_signal@test.com',
            phone='08077777777',
            is_owner=True,
        )
        assert OwnerProfile.objects.filter(user=user).exists()

    def test_owner_profile_not_created_for_renter(self, create_user):
        user = create_user(
            email='renter_signal@test.com',
            phone='08077777778',
            is_renter=True,
            is_owner=False,
        )
        assert not OwnerProfile.objects.filter(user=user).exists()

    def test_owner_profile_created_when_role_switched(self, create_user):
        user = create_user(
            email='switch_signal@test.com',
            phone='08077777779',
            is_renter=True,
            is_owner=False,
        )
        assert not OwnerProfile.objects.filter(user=user).exists()
        user.is_owner = True
        user.save()
        assert OwnerProfile.objects.filter(user=user).exists()


@pytest.mark.django_db
class TestOTPCodeModel:
    def test_otp_str(self, create_user):
        from django.utils import timezone
        user = create_user(email='otp@test.com', phone='08066666661')
        otp = OTPCode.objects.create(
            user=user,
            code='123456',
            otp_type=OTPCode.OTP_TYPE_PHONE,
            expires_at=timezone.now(),
        )
        assert 'phone_verification' in str(otp)
        assert user.email in str(otp)


@pytest.mark.django_db
class TestOwnerProfileModel:
    def test_owner_profile_str(self, owner_user):
        from accounts.models import OwnerProfile
        profile, _ = OwnerProfile.objects.get_or_create(user=owner_user)
        assert owner_user.email in str(profile)
