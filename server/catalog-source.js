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
  let currentUrl = assertAllowedSource(url);
  let response;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    response = await fetchImpl(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/pdf' },
    });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers?.get('location');
    if (!location || redirectCount === 5) throw new Error('PDF inválido');
    currentUrl = assertAllowedSource(new URL(location, currentUrl));
  }
  const finalUrl = assertAllowedSource(response.url || currentUrl.href).href;
  const contentType = String(response.headers?.get('content-type') || '').toLowerCase();
  const declaredLength = Number(response.headers?.get('content-length') || 0);
  if (!response.ok || !contentType.startsWith('application/pdf') || declaredLength > maxBytes) {
    throw new Error('PDF inválido');
  }
  const chunks = [];
  let receivedBytes = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new Error('PDF inválido');
      }
      chunks.push(Buffer.from(value));
    }
  } else {
    const fallback = Buffer.from(await response.arrayBuffer());
    receivedBytes = fallback.length;
    chunks.push(fallback);
  }
  const bytes = Buffer.concat(chunks, receivedBytes);
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
