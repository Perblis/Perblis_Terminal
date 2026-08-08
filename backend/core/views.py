"""Cross-cutting API views: the media presign endpoint and its dev-mode
local upload/serve receivers.

The presign endpoint is the single entry point clients use before uploading any
file (logos, listing photos, verification docs). In prod the returned URL is a
genuine R2 presigned PUT; in dev/CI it points at the local receiver below so the
round-trip works without external storage.
"""

from __future__ import annotations

import mimetypes

from django.http import FileResponse, Http404, HttpResponseRedirect
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
            media.store_private_file(key, content, content_type)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _content_type_for(key: str) -> str:
    """Guess an object's content type from its key.

    ``FileResponse`` only infers this from a real file object; handed a bytes
    iterator it falls back to ``text/html``, which — combined with the
    ``nosniff`` header SecurityMiddleware sets — makes every client refuse to
    render the image. Both serve views therefore state the type explicitly.
    """
    guessed, _ = mimetypes.guess_type(key)
    return guessed or "application/octet-stream"


class MediaPrivateServeView(APIView):
    """Local-mode (dev/CI) private-object serve view — the presigned-GET stand-in.

    Reachable only with a valid, unexpired signed token; the token is minted
    where authorization is enforced (e.g. the handover serializer, parties
    only), exactly mirroring R2's possession-of-URL trust model. Prod serves
    genuine R2 presigned GETs and never hits this view.
    """

    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request):
        token = request.query_params.get("t", "")
        try:
            key = media.parse_private_get_token(token)
            content = media.read_private_file(key)
        except Exception as exc:  # noqa: BLE001 — bad/expired token or missing key => 404
            raise Http404() from exc
        return FileResponse(
            iter([content]),
            filename=key.split("/")[-1],
            content_type=_content_type_for(key),
        )


class MediaServeView(APIView):
    """Public-object read path for both clients.

    R2's public bucket is only reachable over the S3 API endpoint, which is not
    publicly readable, so the portal (PR #42) and the app resolve every public
    media URL onto this endpoint. This is not a dev-only shim — in prod it is how
    listing photos reach the screen.

    In prod it **redirects** to a short-lived presigned R2 URL rather than
    streaming the bytes: the API runs three gunicorn workers, and proxying a
    gallery's worth of photos through them starves the whole process (photos
    load slowly, then not at all). The redirect costs a signature and hands the
    client to Cloudflare's edge. Local mode has no R2, so it serves from disk.
    """

    permission_classes = [AllowAny]

    # Long enough that a gallery scroll reuses one signature, short enough that a
    # leaked URL is worthless. The object key itself is unguessable (UUIDv7).
    PRESIGN_TTL = 60 * 60

    @extend_schema(exclude=True)
    def get(self, request):
        key = request.query_params.get("key", "")
        if not key or ".." in key or key.startswith("/"):
            raise Http404()

        target = media.public_presign_get(key, ttl=self.PRESIGN_TTL)
        if target is not None:
            response = HttpResponseRedirect(target)
            # Cache the *redirect* for well under its TTL so a client never
            # follows a signature that expired while it sat in cache.
            response["Cache-Control"] = f"public, max-age={self.PRESIGN_TTL // 2}"
            return response

        try:
            content = media.read_public_file(key)
        except Exception as exc:  # noqa: BLE001 — missing/invalid key => 404
            raise Http404() from exc
        response = FileResponse(
            iter([content]),
            filename=key.split("/")[-1],
            content_type=_content_type_for(key),
        )
        # Public listing media is immutable — the key changes when the photo does.
        response["Cache-Control"] = "public, max-age=604800, immutable"
        return response
