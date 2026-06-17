"""Reusable model fields.

``EncryptedTextField`` transparently Fernet-encrypts its value at rest: the
Python attribute holds plaintext, the DB column holds ciphertext. Because the
ciphertext is non-deterministic, never query/filter/index on such a column.
"""

from __future__ import annotations

from django.db import models

from core.encryption import decrypt, encrypt


class EncryptedTextField(models.TextField):
    def from_db_value(self, value, expression, connection):
        if value is None or value == "":
            return value
        return decrypt(value)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        return encrypt(str(value))
