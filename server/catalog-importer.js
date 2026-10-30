const REQUIRED_DEPS = [
  'resolve',
  'findByMetadata',
  'download',
  'findByHash',
  'upload',
  'publicUrl',
  'insert',
  'remove',
];

function assertDependencies(deps) {
  for (const name of REQUIRED_DEPS) {
    if (typeof deps?.[name] !== 'function') throw new Error(`Dependência ausente: ${name}`);
  }
}

async function importCatalogBook(candidate, deps) {
  assertDependencies(deps);
  const resolved = await deps.resolve(candidate);
  const metadataMatch = await deps.findByMetadata(resolved.title, resolved.author);
  if (metadataMatch) return { status: 'duplicate', bookId: metadataMatch.id };

  const pdf = await deps.download(resolved.pdfUrl);
  const hashMatch = await deps.findByHash(pdf.sha256);
  if (hashMatch) return { status: 'duplicate', bookId: hashMatch.id };

  const key = `catalog/${pdf.sha256}.pdf`;
  const uploadResult = await deps.upload(key, pdf.bytes, 'application/pdf');
  const ownsUploadedObject = uploadResult?.created !== false;
  try {
    const bookId = await deps.insert({
      ...resolved,
      pdfPath: deps.publicUrl(key),
      pdfSha256: pdf.sha256,
    });
    return { status: 'imported', bookId };
  } catch (error) {
    try {
      if (ownsUploadedObject) await deps.remove(key);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}

module.exports = { assertDependencies, importCatalogBook };
