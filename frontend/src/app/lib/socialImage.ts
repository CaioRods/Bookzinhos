export const SOCIAL_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

const SOCIAL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Gallery images are intentionally uploaded untouched. The book carousel must
 * retain the source dimensions and artwork quality chosen by the publisher.
 */
export async function prepareSocialImage(file: File): Promise<File> {
  if (!SOCIAL_IMAGE_TYPES.has(file.type))
    throw new Error("Use imagens JPG, PNG, WebP ou AVIF.");
  if (file.size > SOCIAL_IMAGE_MAX_BYTES)
    throw new Error("Cada imagem pode ter até 12 MB.");
  return file;
}
