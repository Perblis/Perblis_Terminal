"""Production storage (no DB): Django 5.2 STORAGES + R2 ACL policy."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.unit
def test_production_settings_use_s3_storages_and_omit_object_acl():
    """
    Fresh Django process: STORAGES['default'] must be S3 (Django 5.2 ignores
    DEFAULT_FILE_STORAGE for default_storage alone). AWS_DEFAULT_ACL must be
    None so boto3 PutObject does not send x-amz-acl (R2 often rejects ACLs).
    """
    code = r"""
import os
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
os.environ["SECRET_KEY"] = "x" * 60
os.environ["DEBUG"] = "False"
os.environ["ALLOWED_HOSTS"] = "localhost"
os.environ["DATABASE_URL"] = "postgres://u:p@127.0.0.1:5999/db"
os.environ["R2_ACCESS_KEY_ID"] = "test-access"
os.environ["R2_SECRET_ACCESS_KEY"] = "test-secret"
os.environ["R2_BUCKET"] = "test-bucket"
os.environ["R2_ENDPOINT"] = "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com"
os.environ["R2_PUBLIC_URL"] = "https://pub-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.dev"
import django
django.setup()
from django.conf import settings
assert settings.AWS_DEFAULT_ACL is None, settings.AWS_DEFAULT_ACL
assert settings.STORAGES["default"]["BACKEND"] == "storages.backends.s3boto3.S3Boto3Storage"
assert settings.AWS_STORAGE_BUCKET_NAME == "test-bucket"
assert "r2.cloudflarestorage.com" in settings.AWS_S3_ENDPOINT_URL
assert settings.AWS_S3_CUSTOM_DOMAIN == "pub-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.dev"
"""
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=90,
        env={**os.environ, "PYTHONPATH": str(ROOT)},
    )
    assert proc.returncode == 0, proc.stdout + "\n" + proc.stderr
