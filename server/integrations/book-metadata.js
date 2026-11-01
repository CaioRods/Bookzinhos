const GENRE_RULES = [
  [/romantasy|romantasia/i, "Romantasia"], [/urban fantasy|fantasia urbana/i, "Fantasia urbana"], [/fantasy|fantasia/i, "Fantasia"],
  [/science fiction|fic[cç][aã]o cient[ií]fica/i, "Ficção científica"], [/dystopi|distopi/i, "Distopia"],
  [/historical romance|romance hist[oó]rico/i, "Romance histórico"], [/contemporary romance|romance contempor[aâ]neo/i, "Romance contemporâneo"],
  [/romance|love stor|hist[oó]rias de amor/i, "Romance"], [/myster|mist[eé]rio|detective/i, "Mistério"], [/thriller|suspense/i, "Suspense"],
  [/horror|terror/i, "Terror"], [/dark academia/i, "Dark academia"], [/adventure|aventura/i, "Aventura"],
  [/historical fiction|fic[cç][aã]o hist[oó]rica/i, "Ficção histórica"], [/classic|cl[aá]ssico/i, "Clássicos"],
  [/magic realism|magical realism|realismo m[aá]gico/i, "Realismo mágico"], [/brazilian literature|literatura brasileira/i, "Literatura brasileira"],
  [/poetry|poesia/i, "Poesia"], [/short stor|contos/i, "Contos"], [/autobiograph|autobiografia/i, "Autobiografia"], [/biograph|biografia/i, "Biografia"],
  [/nonfiction|non-fiction|n[aã]o fic[cç][aã]o/i, "Não ficção"], [/self-help|personal development|desenvolvimento pessoal/i, "Desenvolvimento pessoal"],
  [/history|hist[oó]ria$/i, "História"], [/philosoph|filosofia/i, "Filosofia"], [/young adult|adolescen/i, "Young adult"],
  [/juvenile|children|infantojuvenil/i, "Infantojuvenil"], [/new adult/i, "New adult"], [/graphic novel/i, "Graphic novel"], [/manga|mang[aá]/i, "Mangá"], [/lgbt|queer/i, "LGBTQIA+"],
];
function mapGenres(categories) { const text = (Array.isArray(categories) ? categories : []).filter(value => typeof value === "string").join("; "); return [...new Set(GENRE_RULES.filter(([pattern]) => pattern.test(text)).map(([, genre]) => genre))]; }
function plain(value) {
  const text = typeof value === "string" ? value : typeof value?.value === "string" ? value.value : "";
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " " }[entity])).trim().slice(0, 10000);
}
function validIsbn(value) {
  const isbn = String(value || "").replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(isbn) && [...isbn].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) % 10 === 0) return isbn;
  if (/^\d{9}[\dX]$/.test(isbn) && [...isbn].reduce((sum, n, i) => sum + (n === "X" ? 10 : Number(n)) * (10 - i), 0) % 11 === 0) return isbn;
  return null;
}
function googleResult(item) {
  const info = item.volumeInfo || {};
  return { id: item.id, source: "google", sourceUrl: `https://books.google.com/books?id=${encodeURIComponent(item.id)}`, title: plain(info.title), authors: (info.authors || []).filter(value => typeof value === "string").slice(0, 10), description: plain(info.description), genres: mapGenres(info.categories), publisher: plain(info.publisher), publishedYear: String(info.publishedDate || "").slice(0, 4), pageCount: Number(info.pageCount) || null, isbn: (info.industryIdentifiers || []).map(item => validIsbn(item.identifier)).find(Boolean) || null };
}
function createBookMetadata({ fetchImpl = fetch, apiKey = process.env.GOOGLE_BOOKS_API_KEY || "", clock = Date.now } = {}) {
  const cache = new Map();
  async function json(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json", "User-Agent": "Bookzinhos/1.0 (https://github.com/CaioRods/Bookzinhos)" }, redirect: "error" });
    if (!response.ok) throw new Error(response.status === 429 ? "O catálogo atingiu o limite de consultas. Tente a outra fonte ou preencha manualmente." : "O catálogo está indisponível. Tente outra fonte.");
    const text = await response.text(); if (text.length > 2_000_000) throw new Error("Resposta do catálogo grande demais."); return JSON.parse(text);
  }
  async function search({ source = "google", q = "", author = "" }) {
    if (!["google", "openlibrary"].includes(source)) throw new Error("Fonte de metadados inválida.");
    q = String(q).trim().slice(0, 200); author = String(author).trim().slice(0, 150);
    if (q.length < 2) throw new Error("Informe título ou ISBN para buscar.");
    const key = JSON.stringify([source, q, author]), cached = cache.get(key);
    if (cached && cached.until > clock()) return cached.data;
    const isbn = validIsbn(q); let data;
    if (source === "google") {
      const url = new URL("https://www.googleapis.com/books/v1/volumes");
      url.search = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : `intitle:"${q.replace(/["\\]/g, " ")}"${author ? ` inauthor:"${author.replace(/["\\]/g, " ")}"` : ""}`, maxResults: "8", printType: "books", projection: "full" }).toString();
      if (apiKey) url.searchParams.set("key", apiKey);
      const result = await json(url); data = (result.items || []).slice(0, 8).map(googleResult).filter(book => book.title);
    } else {
      const url = new URL("https://openlibrary.org/search.json");
      url.search = new URLSearchParams({ ...(isbn ? { isbn } : { title: q, ...(author ? { author } : {}) }), limit: "8", fields: "key,title,alternative_title,editions,editions.title,author_name,subject", lang: "pt" }).toString();
      const result = await json(url);
      data = (result.docs || []).slice(0, 8).filter(item => /^\/works\/OL[0-9]+W$/.test(item.key || "")).map(item => ({ id: item.key, source, sourceUrl: `https://openlibrary.org${item.key}`, title: plain(item.title), alternativeTitles: [...(Array.isArray(item.alternative_title) ? item.alternative_title : []), ...(item.editions?.docs || []).map(edition => edition.title)].filter(value => typeof value === "string").map(plain).slice(0, 30), authors: (item.author_name || []).slice(0, 10), description: "", genres: mapGenres(item.subject), publisher: "", publishedYear: "", pageCount: null, isbn: null }));
    }
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { data, until: clock() + 10 * 60 * 1000 }); return data;
  }
  async function detail(source, id) {
    if (source !== "openlibrary" || !/^OL[0-9]+W$/.test(id)) throw new Error("Referência de catálogo inválida.");
    const result = await json(new URL(`https://openlibrary.org/works/${id}.json`));
    return { description: plain(result.description), genres: mapGenres(result.subjects) };
  }
  return { search, detail };
}
function metadataFields(body) {
  const source = ["google", "openlibrary"].includes(body.metadataSource) ? body.metadataSource : "";
  const raw = String(body.metadataId || "");
  const id = source === "google" && /^[A-Za-z0-9_-]{1,100}$/.test(raw) ? raw : source === "openlibrary" && /^\/works\/OL[0-9]+W$/.test(raw) ? raw : "";
  return { source: id ? source : "", id, url: !id ? "" : source === "google" ? `https://books.google.com/books?id=${encodeURIComponent(id)}` : `https://openlibrary.org${id}`, isbn: validIsbn(body.isbn) || "" };
}
module.exports = { metadataFields, createBookMetadata, mapGenres, plain, validIsbn, googleResult };
