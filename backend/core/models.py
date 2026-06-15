"""Shared model base.

`BaseModel` gives every domain row a UUIDv7 primary key and created/updated
timestamps (TSD §3.3). Domain apps subclass it; it never gets its own table.
"""

from __future__ import annotations

from django.db import models

from core.ids import uuid7


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
