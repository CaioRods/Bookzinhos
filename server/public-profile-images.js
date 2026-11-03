const sharp = require('sharp');
const { allowedCoverHost } = require('./cover-palette');
const MAX_BYTES = 8 * 1024 * 1024;

// The caller selects a public profile/book ID, never an arbitrary fetch URL.
async function readProfileImage(source, {fetchImpl = fetch, env = process.env} = {}) {
  const url = new URL(source, 'https://bookzinhos-production.up.railway.app');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowedCoverHost(url.hostname, env)) throw new Error('Imagem não autorizada.');
  const appHost = ['bookzinhos-production.up.railway.app','bookzinhos-server.vercel.app'].includes(url.hostname);
  if (appHost && !url.pathname.startsWith('/uploads/')) throw new Error('Imagem não autorizada.');
  if (/^\/(?:api\/)?public\/profiles\//i.test(decodeURIComponent(url.pathname))) throw new Error('Imagem não autorizada.');
  const response = await fetchImpl(url, {redirect:'error', signal:AbortSignal.timeout(8000)});
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Imagem indisponível.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Imagem sem conteúdo.');
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > MAX_BYTES) throw new Error('Imagem grande demais.');
      chunks.push(Buffer.from(value));
    }
  } catch (error) { await reader.cancel().catch(()=>{}); throw error; }
  const image = sharp(Buffer.concat(chunks), {limitInputPixels:20_000_000, animated:false});
  const info = await image.metadata();
  if (!['jpeg','png','webp','heif','avif','gif','tiff'].includes(info.format)) throw new Error('Formato não suportado.');
  return image.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).png().toBuffer();
}

function registerPublicProfileImages({app,db,sql,readImage = readProfileImage}) {
  app.get('/public/profiles/:username/images/:kind/:bookId?', async (req,res) => {
    res.set('Cache-Control','no-store');
    try {
      const [user] = await db.query(sql`SELECT username, avatar, profile_theme_id FROM users WHERE username=${req.params.username} COLLATE NOCASE`);
      if (!user) return res.sendStatus(404);
      let source;
      if (req.params.kind === 'cover' && req.params.bookId) {
        const [book] = await db.query(sql`SELECT cover_image_path FROM books WHERE id=${req.params.bookId} AND is_public=1`);
        source = book?.cover_image_path;
      } else if (req.params.kind === 'avatar') source = user.avatar;
      else if (req.params.kind === 'banner') {
        const [theme] = await db.query(sql`SELECT data FROM appearance_themes WHERE id=${user.profile_theme_id} AND (owner='' OR owner=${user.username} COLLATE NOCASE)`);
        source = theme ? JSON.parse(theme.data).imageUrl : null;
      }
      if (!source || !/^(https?:\/\/|\/(?!\/))/.test(source)) return res.sendStatus(404);
      const image = await readImage(source);
      res.type('png').send(image);
    } catch { res.status(502).json({error:'Não foi possível carregar a imagem pública.'}); }
  });
}
module.exports = {readProfileImage,registerPublicProfileImages};
