import { getInfoAsync, uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { apiFetch, API_V1 } from "./api";

const API_ORIGIN = API_V1.replace(/\/api\/v1$/, "");

/** Object-key prefixes served from the public media bucket (TSD §3.9). */
const PUBLIC_KEY_PREFIXES = ["listings/", "logos/", "avatars/", "handovers/"] as const;

/** Extract an R2 object key from a public media URL returned by the API. */
export function publicMediaKeyFromUrl(url: string): string | null {
  const match = /^https?:\/\/([^/]+)\/(.+)$/.exec(url);
  if (!match) return null;
  const key = match[2].split("?")[0];
  if (PUBLIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return key;
  return null;
}

/**
 * Resolve a media URL for <Image>. The API returns R2 S3-endpoint URLs in
 * prod (`*.r2.cloudflarestorage.com/...`) which are NOT public-readable —
 * the portal hit the same wall (PR #42) and serves media through the
 * backend's `GET /api/v1/media/public?key=` proxy, which reads R2
 * server-side. The app rides the same endpoint; relative dev paths resolve
 * against the API origin as before.
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return "";
  const key = publicMediaKeyFromUrl(url);
  if (key) return `${API_ORIGIN}/api/v1/media/public?key=${encodeURIComponent(key)}`;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Handover photos: client-resize to ≤1920px / ~1MB before upload (TSD §3.9,
// perf gate <5s/5MB on 4G). A locally-captured photo is a stable file URI, so
// this doubles as the offline-queue drainer's upload step (D-016).
const MAX_WIDTH = 1920;

type PresignResponse = {
  key: string;
  bucket: string;
  presigned_put_url: string;
  expires_in: number;
};

export type CapturedPhoto = { uri: string; width?: number; height?: number };

/**
 * Downscale a picked verification document to ≤1600px wide JPEG — the server
 * caps each document at 5 MB and full-resolution phone photos routinely
 * exceed it (the picker's `quality` compresses but never resizes).
 */
export async function prepareVerificationDoc(asset: CapturedPhoto): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== undefined && asset.width > 1600) {
    context.resize({ width: 1600 });
  }
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: image.uri };
}

/**
 * Resize → presign → PUT a handover photo, returning the private-bucket object
 * key to attach to the record. Only downscales (never upscales); the presigned
 * PUT URL is R2-absolute in prod and a relative dev receiver locally, so it is
 * resolved against the API origin either way.
 */
export async function uploadHandoverPhoto(photo: CapturedPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (photo.width !== undefined && photo.width > MAX_WIDTH) {
    context.resize({ width: MAX_WIDTH });
  }
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

  const info = await getInfoAsync(image.uri);
  const fileSize = info.exists && "size" in info ? (info.size ?? 0) : 0;

  const presign = await apiFetch<PresignResponse>("/media/presign", {
    method: "POST",
    body: { kind: "handover_photo", content_type: "image/jpeg", file_size: fileSize },
  });

  const result = await uploadAsync(resolveMediaUrl(presign.presigned_put_url), image.uri, {
    httpMethod: "PUT",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": "image/jpeg" },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Photo upload failed (${result.status})`);
  }
  return presign.key;
}
