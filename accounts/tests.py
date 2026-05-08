import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import OTPCode

User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user(self):
        user = User.objects.create_user(
            email='test@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='John',
            last_name='Doe',
        )
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.check_password('TestPass123!'))
        self.assertTrue(user.is_renter)
        self.assertFalse(user.is_owner)
        self.assertEqual(user.verification_level, 0)
        self.assertFalse(user.is_phone_verified)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='AdminPass123!',
            phone='08000000001',
            first_name='Admin',
            last_name='User',
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_user_str(self):
        user = User.objects.create_user(
            email='str@example.com',
            password='TestPass123!',
            phone='08012345679',
            first_name='Jane',
            last_name='Smith',
        )
        self.assertEqual(str(user), 'Jane Smith <str@example.com>')

    def test_full_name_property(self):
        user = User.objects.create_user(
            email='prop@example.com',
            password='TestPass123!',
            phone='08012345680',
            first_name='Full',
            last_name='Name',
        )
        self.assertEqual(user.full_name, 'Full Name')

    def test_email_is_unique(self):
        User.objects.create_user(
            email='unique@example.com',
            password='TestPass123!',
            phone='08012345681',
        )
        with self.assertRaises(Exception):
            User.objects.create_user(
                email='unique@example.com',
                password='TestPass456!',
                phone='08012345682',
            )

    def test_phone_is_unique(self):
        User.objects.create_user(
            email='phone1@example.com',
            password='TestPass123!',
            phone='08099999999',
        )
        with self.assertRaises(Exception):
            User.objects.create_user(
                email='phone2@example.com',
                password='TestPass456!',
                phone='08099999999',
            )


class RegisterEndpointTests(APITestCase):
    def setUp(self):
        self.url = '/api/v1/auth/register/'
        self.valid_data = {
            'email': 'newuser@example.com',
            'phone': '08012345678',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        }

    def test_register_success(self):
        response = self.client.post(self.url, self.valid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])
        self.assertIn('refresh', data['tokens'])
        self.assertEqual(data['user']['email'], 'newuser@example.com')
        self.assertTrue(data['user']['is_renter'])
        self.assertFalse(data['user']['is_owner'])

    def test_register_creates_user_in_db(self):
        self.client.post(self.url, self.valid_data, format='json')
        user = User.objects.get(email='newuser@example.com')
        self.assertTrue(user.is_email_verified)
        self.assertFalse(user.is_phone_verified)
        self.assertTrue(user.is_renter)

    def test_register_creates_otp(self):
        self.client.post(self.url, self.valid_data, format='json')
        user = User.objects.get(email='newuser@example.com')
        otp = OTPCode.objects.filter(user=user, otp_type=OTPCode.OTP_TYPE_PHONE).first()
        self.assertIsNotNone(otp)
        self.assertFalse(otp.is_used)

    def test_register_password_mismatch(self):
        data = self.valid_data.copy()
        data['password_confirm'] = 'DifferentPass123!'
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_weak_password(self):
        data = self.valid_data.copy()
        data['password'] = '123'
        data['password_confirm'] = '123'
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email(self):
        self.client.post(self.url, self.valid_data, format='json')
        data = self.valid_data.copy()
        data['phone'] = '08099999999'
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_fields(self):
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='login@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Login',
            last_name='User',
        )
        self.url = '/api/v1/auth/login/'

    def test_login_success(self):
        response = self.client.post(self.url, {
            'email': 'login@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('access', data)
        self.assertIn('refresh', data)

    def test_login_wrong_password(self):
        response = self.client.post(self.url, {
            'email': 'login@example.com',
            'password': 'WrongPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_nonexistent_email(self):
        response = self.client.post(self.url, {
            'email': 'nonexistent@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(self.url, {
            'email': 'login@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TokenRefreshTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='refresh@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Refresh',
            last_name='User',
        )
        login_response = self.client.post('/api/v1/auth/login/', {
            'email': 'refresh@example.com',
            'password': 'TestPass123!',
        }, format='json')
        self.refresh_token = login_response.json()['refresh']

    def test_token_refresh_success(self):
        response = self.client.post('/api/v1/auth/token/refresh/', {
            'refresh': self.refresh_token,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.json())

    def test_token_refresh_invalid_token(self):
        response = self.client.post('/api/v1/auth/token/refresh/', {
            'refresh': 'invalid-token',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='logout@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Logout',
            last_name='User',
        )
        login_response = self.client.post('/api/v1/auth/login/', {
            'email': 'logout@example.com',
            'password': 'TestPass123!',
        }, format='json')
        tokens = login_response.json()
        self.access_token = tokens['access']
        self.refresh_token = tokens['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def test_logout_success(self):
        response = self.client.post('/api/v1/auth/logout/', {
            'refresh': self.refresh_token,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])

    def test_logout_blacklists_refresh_token(self):
        self.client.post('/api/v1/auth/logout/', {
            'refresh': self.refresh_token,
        }, format='json')
        response = self.client.post('/api/v1/auth/token/refresh/', {
            'refresh': self.refresh_token,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_unauthenticated(self):
        self.client.credentials()
        response = self.client.post('/api/v1/auth/logout/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class VerifyPhoneTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='verify@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Verify',
            last_name='User',
        )
        self.client.force_authenticate(user=self.user)
        self.otp = OTPCode.objects.create(
            user=self.user,
            code='123456',
            otp_type=OTPCode.OTP_TYPE_PHONE,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

    def test_verify_phone_success(self):
        response = self.client.post('/api/v1/auth/verify-phone/', {
            'otp_code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)

    def test_verify_phone_wrong_code(self):
        response = self.client.post('/api/v1/auth/verify-phone/', {
            'otp_code': '999999',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_phone_verified)

    def test_verify_phone_expired_otp(self):
        self.otp.expires_at = timezone.now() - timedelta(minutes=1)
        self.otp.save()
        response = self.client.post('/api/v1/auth/verify-phone/', {
            'otp_code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_phone_used_otp(self):
        self.otp.is_used = True
        self.otp.save()
        response = self.client.post('/api/v1/auth/verify-phone/', {
            'otp_code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_phone_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/v1/auth/verify-phone/', {
            'otp_code': '123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ResendOTPTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='resend@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Resend',
            last_name='User',
        )
        self.client.force_authenticate(user=self.user)

    def test_resend_otp_success(self):
        response = self.client.post('/api/v1/auth/resend-otp/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])
        self.assertTrue(OTPCode.objects.filter(user=self.user).exists())

    def test_resend_otp_invalidates_previous(self):
        from .services import create_otp
        old_otp = create_otp(self.user, OTPCode.OTP_TYPE_PHONE)
        self.client.post('/api/v1/auth/resend-otp/', format='json')
        old_otp.refresh_from_db()
        self.assertTrue(old_otp.is_used)


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='changepw@example.com',
            password='OldPass123!',
            phone='08012345678',
            first_name='Change',
            last_name='Pass',
        )
        self.client.force_authenticate(user=self.user)

    def test_change_password_success(self):
        response = self.client.post('/api/v1/auth/password/change/', {
            'old_password': 'OldPass123!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass456!'))

    def test_change_password_wrong_old(self):
        response = self.client.post('/api/v1/auth/password/change/', {
            'old_password': 'WrongOld123!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_mismatch(self):
        response = self.client.post('/api/v1/auth/password/change/', {
            'old_password': 'OldPass123!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'DifferentPass!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/v1/auth/password/change/', {
            'old_password': 'OldPass123!',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='reset@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Reset',
            last_name='User',
        )

    def test_password_reset_request_success(self):
        response = self.client.post('/api/v1/auth/password/reset/', {
            'email': 'reset@example.com',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])
        self.assertTrue(
            OTPCode.objects.filter(
                user=self.user, otp_type=OTPCode.OTP_TYPE_PASSWORD_RESET
            ).exists()
        )

    def test_password_reset_request_nonexistent_email(self):
        response = self.client.post('/api/v1/auth/password/reset/', {
            'email': 'nonexistent@example.com',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])

    def test_password_reset_confirm_success(self):
        OTPCode.objects.create(
            user=self.user,
            code='654321',
            otp_type=OTPCode.OTP_TYPE_PASSWORD_RESET,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        response = self.client.post('/api/v1/auth/password/reset/confirm/', {
            'email': 'reset@example.com',
            'otp_code': '654321',
            'new_password': 'BrandNew789!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNew789!'))

    def test_password_reset_confirm_wrong_otp(self):
        OTPCode.objects.create(
            user=self.user,
            code='654321',
            otp_type=OTPCode.OTP_TYPE_PASSWORD_RESET,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        response = self.client.post('/api/v1/auth/password/reset/confirm/', {
            'email': 'reset@example.com',
            'otp_code': '000000',
            'new_password': 'BrandNew789!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_confirm_nonexistent_email(self):
        response = self.client.post('/api/v1/auth/password/reset/confirm/', {
            'email': 'doesnotexist@example.com',
            'otp_code': '654321',
            'new_password': 'BrandNew789!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserMeEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='me@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Me',
            last_name='User',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_me(self):
        response = self.client.get('/api/v1/users/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['email'], 'me@example.com')
        self.assertEqual(data['data']['first_name'], 'Me')
        self.assertEqual(data['data']['last_name'], 'User')
        self.assertEqual(data['data']['full_name'], 'Me User')
        self.assertTrue(data['data']['is_renter'])
        self.assertFalse(data['data']['is_owner'])

    def test_patch_me(self):
        response = self.client.patch('/api/v1/users/me/', {
            'first_name': 'Updated',
            'bio': 'Hello world',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['first_name'], 'Updated')
        self.assertEqual(data['data']['bio'], 'Hello world')

    def test_put_me(self):
        response = self.client.put('/api/v1/users/me/', {
            'first_name': 'Put',
            'last_name': 'Update',
            'phone': '08099999999',
            'bio': 'Updated bio',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['data']['first_name'], 'Put')

    def test_get_me_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/v1/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UpdateRoleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='role@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Role',
            last_name='User',
        )
        self.client.force_authenticate(user=self.user)

    def test_enable_owner_role(self):
        response = self.client.patch('/api/v1/users/me/role/', {
            'is_owner': True,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['data']['is_owner'])
        self.assertTrue(response.json()['data']['is_renter'])

    def test_disable_renter_while_owner(self):
        self.user.is_owner = True
        self.user.save()
        response = self.client.patch('/api/v1/users/me/role/', {
            'is_renter': False,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.json()['data']['is_renter'])
        self.assertTrue(response.json()['data']['is_owner'])

    def test_cannot_disable_both_roles(self):
        response = self.client.patch('/api/v1/users/me/role/', {
            'is_owner': False,
            'is_renter': False,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DocumentUploadTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='doc@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Doc',
            last_name='User',
        )
        self.client.force_authenticate(user=self.user)

    def test_upload_document_success(self):
        doc_file = SimpleUploadedFile(
            "test_id.pdf", b"fake pdf content", content_type="application/pdf"
        )
        response = self.client.post('/api/v1/users/me/documents/', {
            'document_file': doc_file,
            'document_type': 'government_id',
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['document_type'], 'government_id')
        self.assertEqual(data['data']['status'], 'approved')

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_id_verified)
        self.assertEqual(self.user.verification_level, 1)

    def test_upload_business_document(self):
        doc_file = SimpleUploadedFile(
            "business.pdf", b"fake biz content", content_type="application/pdf"
        )
        response = self.client.post('/api/v1/users/me/documents/', {
            'document_file': doc_file,
            'document_type': 'business_registration',
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['data']['document_type'], 'business_registration')

    def test_upload_invalid_document_type(self):
        doc_file = SimpleUploadedFile(
            "test.pdf", b"fake content", content_type="application/pdf"
        )
        response = self.client.post('/api/v1/users/me/documents/', {
            'document_file': doc_file,
            'document_type': 'invalid_type',
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_without_file(self):
        response = self.client.post('/api/v1/users/me/documents/', {
            'document_type': 'government_id',
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PublicProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='public@example.com',
            password='TestPass123!',
            phone='08012345678',
            first_name='Public',
            last_name='Profile',
        )

    def test_get_public_profile(self):
        response = self.client.get(f'/api/v1/users/{self.user.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['full_name'], 'Public Profile')
        self.assertNotIn('email', data['data'])
        self.assertNotIn('phone', data['data'])

    def test_get_public_profile_nonexistent(self):
        fake_id = uuid.uuid4()
        response = self.client.get(f'/api/v1/users/{fake_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_profile_no_auth_required(self):
        response = self.client.get(f'/api/v1/users/{self.user.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ProtectedEndpointsTests(APITestCase):
    """Test that protected endpoints return 401 without auth."""

    def test_me_requires_auth(self):
        response = self.client.get('/api/v1/users/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_role_requires_auth(self):
        response = self.client.patch('/api/v1/users/me/role/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_documents_requires_auth(self):
        response = self.client.post('/api/v1/users/me/documents/', {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verify_phone_requires_auth(self):
        response = self.client.post('/api/v1/auth/verify-phone/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_requires_auth(self):
        response = self.client.post('/api/v1/auth/password/change/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_auth(self):
        response = self.client.post('/api/v1/auth/logout/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_resend_otp_requires_auth(self):
        response = self.client.post('/api/v1/auth/resend-otp/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class HealthCheckTests(APITestCase):
    def test_health_check(self):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {'status': 'ok', 'service': 'Terminal API'})


class APISchemaTests(APITestCase):
    def test_schema_accessible(self):
        response = self.client.get('/api/schema/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_swagger_ui_accessible(self):
        response = self.client.get('/api/docs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
