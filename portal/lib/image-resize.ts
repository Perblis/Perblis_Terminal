import { isAllowedPhotoType } from "@/lib/api";

/** 07 §9: client resize to ≤1920px JPEG before the presigned PUT. */
export async function resizeImage(file: File): Promise<Blob> {
  if (!isAllowedPhotoType(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1024 * 1024 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82),
    );
  } catch {
    return file; // resize is best-effort; the server enforces the size cap
  }
}
