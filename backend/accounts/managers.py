"""User manager — email is the login identifier."""

from __future__ import annotations

from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, phone: str, password: str | None, **extra):
        if not email:
            raise ValueError("Users must have an email address.")
        if not phone:
            raise ValueError("Users must have a phone number.")
        email = self.normalize_email(email)
        user = self.model(email=email, phone=phone, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, phone: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, phone, password, **extra)

    def create_superuser(self, email: str, phone: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, phone, password, **extra)
