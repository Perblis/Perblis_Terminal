"""Cross-cutting API views: the media presign endpoint and its dev-mode
local upload/serve receivers.

The presign endpoint is the single entry point clients use before uploading any
file (logos, listing photos, verification docs). In prod the returned URL is a
genuine R2 presigned PUT; in dev/CI it points at the local receiver below so the
round-trip works without external storage.
"""

from __future__ import annotations

from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import BaseParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core import media
from core.serializers import MediaPresignResponseSerializer, MediaPresignSerializer


class MediaPresignView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MediaPresignSerializer

    @extend_schema(responses={200: MediaPresignResponseSerializer})
    def post(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        result = media.presign_upload(
            kind=v["kind"],
            content_type=v["content_type"],
            file_size=v["file_size"],
        )
        return Response(result, status=status.HTTP_200_OK)


class _RawUploadParser(BaseParser):
    """Hand the raw request body to the view untouched (any content type)."""

    media_type = "*/*"

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read()


class MediaUploadView(APIView):
    """Local-mode (dev/CI) receiver for presigned PUTs. Token-authorised."""

    permission_classes = [AllowAny]
    parser_classes = [_RawUploadParser]

    @extend_schema(exclude=True)
    def put(self, request):
        token = request.query_params.get("t", "")
        try:
            bucket, key = media.parse_local_upload_token(token)
        except Exception as exc:  # noqa: BLE001 — bad/expired token => 404
            raise Http404() from exc
        content = request.data if isinstance(request.data, bytes) else b""
        content_type = request.content_type or "application/octet-stream"
        if bucket == "public":
            media.store_public_file(key, content, content_type)
        else:
            from accounts.integrations.media import store_private_file

            store_private_file(key, content, content_type)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaServeView(APIView):
    """Local-mode (dev/CI) public-object serve view. Prod serves from R2 directly."""

    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request):
        key = request.query_params.get("key", "")
        try:
            content = media.read_public_file(key)
        except Exception as exc:  # noqa: BLE001 — missing/invalid key => 404
            raise Http404() from exc
        return FileResponse(iter([content]), filename=key.split("/")[-1])
