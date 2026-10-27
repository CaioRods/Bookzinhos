/** Keeps multi-image posts within the serverless request limit. */
export async function prepareSocialImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 20000 || bitmap.height > 20000)
      throw new Error("A imagem é muito grande. Use até 20.000 px por lado.");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob && blob.size <= 480000)
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
          type: "image/webp",
        });
    }
    throw new Error(
      "Esta imagem contém detalhes demais. Envie uma versão menor.",
    );
  } finally {
    bitmap.close();
  }
}
