const { createHash } = require('node:crypto');
const { importCatalogBook } = require('./catalog-importer');

function candidateId(candidate) {
  try {
    const officialId = new URL(candidate.detailUrl).searchParams.get('co_obra');
    if (officialId) return `mec-${officialId}`;
  } catch {}
  return `mec-${createHash('sha256').update(`${candidate.title}|${candidate.author}`).digest('hex').slice(0, 12)}`;
}

function cleanError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, ' ').slice(0, 300);
}

async function validateCandidate(candidate, deps) {
  const resolved = await deps.resolve(candidate);
  const metadataMatch = await deps.findByMetadata(resolved.title, resolved.author);
  if (metadataMatch) return { status: 'duplicate', bookId: metadataMatch.id };
  const pdf = await deps.download(resolved.pdfUrl);
  const hashMatch = await deps.findByHash(pdf.sha256);
  if (hashMatch) return { status: 'duplicate', bookId: hashMatch.id };
  return { status: 'validated' };
}

async function runCatalogImport({ dryRun = false, resume = false, manifest = [], checkpoint = { completed: [] }, deps, onItem = () => {} } = {}) {
  const completed = new Set(Array.isArray(checkpoint.completed) ? checkpoint.completed : []);
  const report = {
    dryRun,
    attemptedIds: [],
    validated: 0,
    imported: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  for (const candidate of manifest) {
    const id = candidateId(candidate);
    if (resume && completed.has(id)) {
      report.skipped += 1;
      onItem({ id, status: 'skipped', reason: 'checkpoint' });
      continue;
    }
    report.attemptedIds.push(id);
    try {
      const result = dryRun
        ? await validateCandidate(candidate, deps)
        : await importCatalogBook(candidate, deps);
      if (dryRun && result.status === 'validated') report.validated += 1;
      if (result.status === 'imported') report.imported += 1;
      if (result.status === 'duplicate') report.duplicates += 1;
      completed.add(id);
      checkpoint.completed = [...completed];
      if (!dryRun && typeof deps.saveCheckpoint === 'function') await deps.saveCheckpoint(checkpoint);
      onItem({ id, title: candidate.title, ...result });
    } catch (error) {
      report.failed += 1;
      const message = cleanError(error);
      report.errors.push({ id, message });
      onItem({ id, title: candidate.title, status: 'failed', reason: message });
    }
  }
  return report;
}

module.exports = { candidateId, cleanError, validateCandidate, runCatalogImport };
