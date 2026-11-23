/** Scale (width, height) down to fit inside a max x max box, keeping the shape. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export function isSupportedImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
}

/**
 * Shrink a photo on the device before uploading: phone/iPad photos are often
 * 4000px and several MB. Re-encoding as JPEG also strips location metadata.
 */
export async function resizePhoto(file: Blob, maxSize: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That file couldn't be read as a picture.");
  });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process that picture.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that picture."))), "image/jpeg", quality),
  );
}
