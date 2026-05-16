import pytest
from unittest.mock import patch
from django.utils import timezone
from datetime import timedelta
from accounts.models import OTPCode
from accounts.services import (
    generate_otp_code,
    create_otp,
    verify_otp,
    process_document_upload,
)


@pytest.mark.unit
class TestGenerateOTPCode:
    def test_generates_6_digits(self):
        code = generate_otp_code()
        assert len(code) == 6
        assert code.isdigit()

    def test_generates_different_codes(self):
        codes = {generate_otp_code() for _ in range(20)}
        assert len(codes) > 1


@pytest.mark.django_db
class TestCreateOTP:
    def test_creates_otp_record(self, create_user):
        user = create_user(email='otp_create@test.com', phone='08055551111')
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        assert OTPCode.objects.filter(user=user, otp_type=OTPCode.OTP_TYPE_PHONE).exists()
        assert otp.is_used is False

    def test_invalidates_previous_otps(self, create_user):
        user = create_user(email='otp_inv@test.com', phone='08055551112')
        otp1 = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        otp2 = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        otp1.refresh_from_db()
        assert otp1.is_used is True
        assert otp2.is_used is False

    def test_prints_to_console(self, create_user, capsys):
        user = create_user(email='otp_print@test.com', phone='08055551113')
        create_otp(user, OTPCode.OTP_TYPE_PHONE)
        captured = capsys.readouterr()
        assert '[DEV OTP]' in captured.out
        assert user.email in captured.out

    def test_otp_expires_in_10_minutes(self, create_user):
        user = create_user(email='otp_exp@test.com', phone='08055551114')
        before = timezone.now()
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        after = timezone.now()
        expected_min = before + timedelta(minutes=9, seconds=59)
        expected_max = after + timedelta(minutes=10, seconds=1)
        assert expected_min <= otp.expires_at <= expected_max


@pytest.mark.django_db
class TestVerifyOTP:
    def test_valid_otp_returns_true(self, create_user):
        user = create_user(email='otp_v1@test.com', phone='08055551121')
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        assert verify_otp(user, otp.code, OTPCode.OTP_TYPE_PHONE) is True

    def test_valid_otp_marks_as_used(self, create_user):
        user = create_user(email='otp_v2@test.com', phone='08055551122')
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        verify_otp(user, otp.code, OTPCode.OTP_TYPE_PHONE)
        otp.refresh_from_db()
        assert otp.is_used is True

    def test_wrong_code_returns_false(self, create_user):
        user = create_user(email='otp_v3@test.com', phone='08055551123')
        create_otp(user, OTPCode.OTP_TYPE_PHONE)
        assert verify_otp(user, '000000', OTPCode.OTP_TYPE_PHONE) is False

    def test_expired_otp_returns_false(self, create_user):
        user = create_user(email='otp_v4@test.com', phone='08055551124')
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        otp.expires_at = timezone.now() - timedelta(minutes=1)
        otp.save()
        assert verify_otp(user, otp.code, OTPCode.OTP_TYPE_PHONE) is False

    def test_used_otp_returns_false(self, create_user):
        user = create_user(email='otp_v5@test.com', phone='08055551125')
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        verify_otp(user, otp.code, OTPCode.OTP_TYPE_PHONE)
        assert verify_otp(user, otp.code, OTPCode.OTP_TYPE_PHONE) is False

    def test_wrong_type_returns_false(self, create_user):
        user = create_user(email='otp_v6@test.com', phone='08055551126')
        otp = create_otp(user, OTPCode.OTP_TYPE_PHONE)
        assert verify_otp(user, otp.code, OTPCode.OTP_TYPE_PASSWORD_RESET) is False


@pytest.mark.django_db
class TestProcessDocumentUpload:
    def test_auto_approves_document(self, owner_user):
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_file = SimpleUploadedFile('id.pdf', b'content', content_type='application/pdf')
        doc = process_document_upload(owner_user, fake_file, 'government_id')
        assert doc.status == 'approved'

    def test_sets_user_id_verified(self, owner_user):
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_file = SimpleUploadedFile('id2.pdf', b'content', content_type='application/pdf')
        process_document_upload(owner_user, fake_file, 'government_id')
        owner_user.refresh_from_db()
        assert owner_user.is_id_verified is True
        assert owner_user.verification_level == 1

    def test_prints_dev_kyc_to_console(self, owner_user, capsys):
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_file = SimpleUploadedFile('id3.pdf', b'content', content_type='application/pdf')
        process_document_upload(owner_user, fake_file, 'government_id')
        captured = capsys.readouterr()
        assert '[DEV KYC]' in captured.out


@pytest.mark.django_db
class TestAuthAPI:
    BASE_URL = '/api/v1/auth'

    def test_register_success(self, api_client):
        response = api_client.post(f'{self.BASE_URL}/register/', {
            'email': 'newuser@test.com',
            'phone': '08099998881',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'securepass123!',
            'password_confirm': 'securepass123!',
        })
        assert response.status_code == 201
        assert 'tokens' in response.data
        assert 'access' in response.data['tokens']
        assert 'refresh' in response.data['tokens']

    def test_register_auto_verifies_email(self, api_client):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        api_client.post(f'{self.BASE_URL}/register/', {
            'email': 'autoverify@test.com',
            'phone': '08099998882',
            'first_name': 'Auto',
            'last_name': 'Verify',
            'password': 'securepass123!',
            'password_confirm': 'securepass123!',
        })
        user = User.objects.get(email='autoverify@test.com')
        assert user.is_email_verified is True

    def test_register_prints_otp(self, api_client, capsys):
        api_client.post(f'{self.BASE_URL}/register/', {
            'email': 'otpprint@test.com',
            'phone': '08099998883',
            'first_name': 'OTP',
            'last_name': 'Print',
            'password': 'securepass123!',
            'password_confirm': 'securepass123!',
        })
        captured = capsys.readouterr()
        assert '[DEV OTP]' in captured.out

    def test_register_password_mismatch(self, api_client):
        response = api_client.post(f'{self.BASE_URL}/register/', {
            'email': 'mismatch@test.com',
            'phone': '08099998884',
            'first_name': 'Test',
            'last_name': 'User',
            'password': 'securepass123!',
            'password_confirm': 'wrongpass123!',
        })
        assert response.status_code == 400

    def test_register_duplicate_email(self, api_client, renter_user):
        response = api_client.post(f'{self.BASE_URL}/register/', {
            'email': renter_user.email,
            'phone': '08099998885',
            'first_name': 'Dup',
            'last_name': 'User',
            'password': 'securepass123!',
            'password_confirm': 'securepass123!',
        })
        assert response.status_code == 400

    def test_login_success(self, api_client, renter_user):
        response = api_client.post(f'{self.BASE_URL}/login/', {
            'email': renter_user.email,
            'password': 'testpass123!',
        })
        assert response.status_code == 200
        assert 'access' in response.data

    def test_token_refresh_returns_rotated_refresh_token(self, api_client, renter_user):
        """Clients must persist the new refresh when rotation + blacklist are enabled."""
        from rest_framework.test import APIClient
        login_response = APIClient().post(f'{self.BASE_URL}/login/', {
            'email': renter_user.email,
            'password': 'testpass123!',
        })
        assert login_response.status_code == 200
        old_refresh = login_response.data['refresh']
        refresh_response = api_client.post(f'{self.BASE_URL}/token/refresh/', {
            'refresh': old_refresh,
        })
        assert refresh_response.status_code == 200
        assert 'access' in refresh_response.data
        assert 'refresh' in refresh_response.data
        assert refresh_response.data['refresh'] != old_refresh

    def test_login_wrong_password(self, api_client, renter_user):
        response = api_client.post(f'{self.BASE_URL}/login/', {
            'email': renter_user.email,
            'password': 'wrongpassword',
        })
        assert response.status_code == 401

    def test_login_jwt_contains_role_fields(self, api_client, owner_user):
        response = api_client.post(f'{self.BASE_URL}/login/', {
            'email': owner_user.email,
            'password': 'testpass123!',
        })
        import jwt as pyjwt
        token = response.data['access']
        payload = pyjwt.decode(token, options={"verify_signature": False})
        assert 'is_owner' in payload
        assert 'is_renter' in payload
        assert payload['is_owner'] is True

    def test_logout_blacklists_token(self, auth_client, renter_user):
        from rest_framework.test import APIClient
        login_response = APIClient().post(f'{self.BASE_URL}/login/', {
            'email': renter_user.email,
            'password': 'testpass123!',
        })
        refresh_token = login_response.data['refresh']
        response = auth_client.post(f'{self.BASE_URL}/logout/', {
            'refresh': refresh_token,
        })
        assert response.status_code == 200

    def test_verify_phone_with_correct_otp(self, auth_client, renter_user, capsys):
        from rest_framework.test import APIClient
        create_response = APIClient()
        create_response.force_authenticate(user=renter_user)
        create_response.post(f'{self.BASE_URL}/resend-otp/')
        capsys.readouterr()

        from accounts.models import OTPCode
        otp = OTPCode.objects.filter(
            user=renter_user,
            otp_type=OTPCode.OTP_TYPE_PHONE,
            is_used=False,
        ).last()

        response = auth_client.post(f'{self.BASE_URL}/verify-phone/', {
            'otp_code': otp.code,
        })
        assert response.status_code == 200
        renter_user.refresh_from_db()
        assert renter_user.is_phone_verified is True

    def test_verify_phone_with_wrong_otp(self, auth_client):
        response = auth_client.post(f'{self.BASE_URL}/verify-phone/', {
            'otp_code': '000000',
        })
        assert response.status_code == 400

    def test_password_reset_request_does_not_reveal_email_existence(self, api_client):
        response = api_client.post(f'{self.BASE_URL}/password/reset/', {
            'email': 'nonexistent@example.com',
        })
        assert response.status_code == 200

    def test_password_reset_confirm_success(self, api_client, create_user):
        from accounts.services import create_otp
        from accounts.models import OTPCode
        user = create_user(email='reset@test.com', phone='08099998886')
        otp = create_otp(user, OTPCode.OTP_TYPE_PASSWORD_RESET)
        response = api_client.post(f'{self.BASE_URL}/password/reset/confirm/', {
            'email': user.email,
            'otp_code': otp.code,
            'new_password': 'newpassword123!',
        })
        assert response.status_code == 200

    def test_unauthenticated_cannot_access_protected_route(self, api_client):
        response = api_client.get('/api/v1/users/me/')
        assert response.status_code == 401


@pytest.mark.django_db
class TestUserAPI:
    BASE_URL = '/api/v1/users'

    def test_get_own_profile(self, auth_client, renter_user):
        response = auth_client.get(f'{self.BASE_URL}/me/')
        assert response.status_code == 200
        assert response.data['data']['email'] == renter_user.email

    def test_profile_includes_unread_messages(self, auth_client):
        response = auth_client.get(f'{self.BASE_URL}/me/')
        assert 'unread_messages' in response.data['data']

    def test_update_profile(self, auth_client):
        response = auth_client.patch(f'{self.BASE_URL}/me/', {
            'first_name': 'Updated',
            'bio': 'New bio',
        })
        assert response.status_code == 200

    def test_update_role_to_owner(self, auth_client, renter_user):
        response = auth_client.patch(f'{self.BASE_URL}/me/role/', {
            'is_owner': True,
        })
        assert response.status_code == 200
        renter_user.refresh_from_db()
        assert renter_user.is_owner is True

    def test_cannot_disable_both_roles(self, dual_client):
        response = dual_client.patch('/api/v1/users/me/role/', {
            'is_owner': False,
            'is_renter': False,
        })
        assert response.status_code == 400

    def test_public_profile_is_accessible_without_auth(self, api_client, renter_user):
        response = api_client.get(f'{self.BASE_URL}/{renter_user.id}/')
        assert response.status_code == 200
        assert 'email' not in response.data['data']

    def test_public_profile_excludes_sensitive_fields(self, api_client, renter_user):
        response = api_client.get(f'{self.BASE_URL}/{renter_user.id}/')
        data = response.data['data']
        assert 'phone' not in data
        assert 'email' not in data

    def test_public_profile_404_for_nonexistent(self, api_client):
        import uuid
        response = api_client.get(f'{self.BASE_URL}/{uuid.uuid4()}/')
        assert response.status_code == 404

    def test_unauthenticated_cannot_get_own_profile(self, api_client):
        response = api_client.get(f'{self.BASE_URL}/me/')
        assert response.status_code == 401
