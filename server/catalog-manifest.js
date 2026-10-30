const manifest = require('./catalog/mec-known-books.json');
const { assertAllowedSource } = require('./catalog-source');

function loadCuratedManifest() {
  const seen = new Set();
  return manifest.map((entry) => {
    const book = {
      title: String(entry.title || '').trim(),
      author: String(entry.author || '').trim(),
      genre: String(entry.genre || '').trim(),
      detailUrl: String(entry.detailUrl || '').trim(),
      licenseStatus: String(entry.licenseStatus || '').trim(),
      ipr: Number(entry.ipr),
    };
    assertAllowedSource(book.detailUrl);
    if (!book.title || !book.author || !book.genre || book.licenseStatus !== 'dominio-publico' || !Number.isInteger(book.ipr) || book.ipr < 10 || book.ipr > 29) {
      throw new Error('Manifesto inválido');
    }
    const key = `${book.title}|${book.author}`.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) throw new Error('Livro duplicado no manifesto');
    seen.add(key);
    return Object.freeze(book);
  });
}

module.exports = { loadCuratedManifest };
