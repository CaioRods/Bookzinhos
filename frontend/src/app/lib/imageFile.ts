/** Reads dimensions without modifying the original image; cropping is non-destructive. */
export async function inspectImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Use JPG, PNG, WebP ou AVIF.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth > 20000 || image.naturalHeight > 20000) throw new Error('A imagem deve ter no máximo 20.000 px por lado.');
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}
