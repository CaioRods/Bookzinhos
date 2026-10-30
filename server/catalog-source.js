const { createHash } = require('node:crypto');

const ALLOWED_HOSTS = new Set([
  'meclivros.mec.gov.br',
  'dominiopublico.mec.gov.br',
]);

function assertAllowedSource(value) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new Error('Fonte não permitida');
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Fonte não permitida');
  }
  return url;
}

async function downloadOfficialPdf({ url, fetchImpl = fetch, maxBytes = 80 * 1024 * 1024, timeoutMs = 30000 } = {}) {
  const sourceUrl = assertAllowedSource(url);
  const response = await fetchImpl(sourceUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/pdf' },
  });
  const finalUrl = assertAllowedSource(response.url || sourceUrl.href).href;
  const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
  const declaredLength = Number(response.headers?.get('content-length') || 0);
  if (!response.ok || !contentType.startsWith('application/pdf') || declaredLength > maxBytes) {
    throw new Error('PDF inválido');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxBytes || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('PDF inválido');
  }
  return {
    bytes,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType: 'application/pdf',
    finalUrl,
  };
}

module.exports = { ALLOWED_HOSTS, assertAllowedSource, downloadOfficialPdf };
