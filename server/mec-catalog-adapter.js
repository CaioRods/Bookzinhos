const { assertAllowedSource } = require('./catalog-source');

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function extractMeta(html, name) {
  const tags = String(html).match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const metaName = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (metaName?.toLowerCase() !== name.toLowerCase()) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return decodeHtml(content).trim();
  }
  return '';
}

function extractOfficialDownloadLink(html, detailUrl) {
  const links = String(html).match(/\bhref\s*=\s*["'][^"']+["']/gi) || [];
  for (const link of links) {
    const href = decodeHtml(link.match(/["']([^"']+)["']/)?.[1] || '');
    if (!/DetalheObraDownload\.do|\/download\/[^?#]+\.pdf(?:$|[?#])/i.test(href)) continue;
    const resolved = new URL(href, detailUrl);
    assertAllowedSource(resolved);
    return resolved.href;
  }
  throw new Error('PDF oficial não encontrado');
}

async function resolveMecBook(candidate, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (!candidate || candidate.licenseStatus !== 'dominio-publico') {
    throw new Error('Acesso controlado não permitido');
  }
  const detailUrl = assertAllowedSource(candidate.detailUrl);
  if (candidate.pdfUrl) {
    return Object.freeze({
      title: candidate.title,
      author: candidate.author,
      genre: candidate.genre,
      description: candidate.description || '',
      pdfUrl: assertAllowedSource(candidate.pdfUrl).href,
      coverUrl: candidate.coverUrl || '',
      sourceUrl: detailUrl.href,
      licenseStatus: candidate.licenseStatus,
      ipr: candidate.ipr,
    });
  }
  const response = await fetchImpl(detailUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) throw new Error(`Página MEC indisponível: ${response.status}`);
  if (response.url) assertAllowedSource(response.url);
  const html = await response.text();
  if (/empr[eé]stimo\s+controlado|fa[çc]a\s+login|acesso\s+restrito/i.test(html)) {
    throw new Error('Acesso controlado não permitido');
  }
  const pdfUrl = extractOfficialDownloadLink(html, detailUrl);
  return Object.freeze({
    title: candidate.title,
    author: candidate.author,
    genre: candidate.genre,
    description: extractMeta(html, 'description'),
    pdfUrl,
    coverUrl: extractMeta(html, 'og:image'),
    sourceUrl: detailUrl.href,
    licenseStatus: candidate.licenseStatus,
    ipr: candidate.ipr,
  });
}

module.exports = { decodeHtml, extractMeta, extractOfficialDownloadLink, resolveMecBook };
