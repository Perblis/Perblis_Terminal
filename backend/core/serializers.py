"""Shared / cross-cutting serializers."""

from __future__ import annotations

from rest_framework import serializers

from core import media


class MediaPresignSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=sorted(media.MEDIA_KINDS))
    content_type = serializers.CharField(max_length=128)
    file_size = serializers.IntegerField(min_value=1)


class MediaPresignResponseSerializer(serializers.Serializer):
    key = serializers.CharField()
    bucket = serializers.CharField()
    presigned_put_url = serializers.CharField()
    expires_in = serializers.IntegerField()
