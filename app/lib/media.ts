import { getInfoAsync, uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { apiFetch, API_V1 } from "./api";

const API_ORIGIN = API_V1.replace(/\/api\/v1$/, "");

/**
 * Listing photo URLs are absolute R2 public URLs in prod but RELATIVE
 * dev-proxy paths when R2 isn't configured — resolve against the API origin.
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return "";
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
