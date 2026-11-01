const sharp = require('sharp');
const MAX_BYTES = 8 * 1024 * 1024;
function allowedCoverHost(hostname, env = process.env) {
  const hosts = new Set(['bookzinhos-production.up.railway.app', 'bookzinhos-server.vercel.app']);
  for (const value of [env.SUPABASE_URL, env.S3_PUBLIC_URL_PREFIX, env.S3_ENDPOINT, ...(env.COVER_IMAGE_HOSTS || '').split(',')]) {
    if (!value) continue;
    try { hosts.add(new URL(value.includes('://') ? value : `https://${value}`).hostname); } catch {}
  }
  return hosts.has(hostname) || /^[a-z0-9-]+\.supabase\.(co|in)$/.test(hostname) || /^[a-z0-9-]+\.r2\.dev$/.test(hostname);
}
function paletteFromPixels(data) {
  const buckets = new Map(), accents = new Map(); let total = 0;
  const add = (map, key, r, g, b) => { const value = map.get(key) || { n: 0, r: 0, g: 0, b: 0 }; value.n++; value.r += r; value.g += g; value.b += b; map.set(key, value); };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [r,g,b] = data.subarray(i,i+3), max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255, delta = max-min, light = (max+min)/2;
    const saturation = delta ? delta/(1-Math.abs(2*light-1)) : 0;
    let hue = !delta ? 0 : max === r/255 ? ((g-b)/255/delta)%6 : max === g/255 ? (b-r)/255/delta+2 : (r-g)/255/delta+4;
    hue = (hue*60+360)%360; total++;
    add(buckets,`${Math.round(r/24)}:${Math.round(g/24)}:${Math.round(b/24)}`,r,g,b);
    if (saturation >= .25 && light >= .1 && light <= .9) add(accents,Math.round(hue/12)%30,r,g,b);
  }
  const largest = map => [...map.values()].sort((a,b)=>b.n-a.n)[0];
  const accent = largest(accents), best = accent && accent.n/total >= .08 ? accent : largest(buckets);
  if (!best) throw new Error('A capa não possui pixels visíveis.');
  const average = [best.r/best.n,best.g/best.n,best.b/best.n];let rgb = [0,0,0], distance = Infinity;
  for (let i=0;i<data.length;i+=4) {
    if(data[i+3]<200)continue;
    const next=(data[i]-average[0])**2+(data[i+1]-average[1])**2+(data[i+2]-average[2])**2;
    if(next<distance){distance=next;rgb=[data[i],data[i+1],data[i+2]];}
  }
  const hex = values => '#'+values.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
  return {base:hex(rgb),shade:hex(rgb.map(value=>value*.72)),tint:hex(rgb.map(value=>value+(255-value)*.2)),ink:rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>155?'#171717':'#ffffff'};
}
async function readCoverPalette(source, { fetchImpl = fetch, env = process.env } = {}) {
  const url = new URL(source, 'https://bookzinhos-production.up.railway.app');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || !allowedCoverHost(url.hostname, env)) throw new Error('Host da capa não autorizado para extração de cor.');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), redirect:'error' });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Capa indisponível ou grande demais.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Capa sem conteúdo.');
  const chunks = []; let bytes = 0;
  try { while (true) { const {done,value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_BYTES) throw new Error('Capa grande demais.'); chunks.push(Buffer.from(value)); } }
  catch (error) { await reader.cancel().catch(()=>{}); throw error; }
  const image = sharp(Buffer.concat(chunks), {limitInputPixels:20_000_000,animated:false});
  const info = await image.metadata();
  if (!['jpeg','png','webp','heif','avif','gif','tiff'].includes(info.format)) throw new Error('Formato de capa não suportado para extração de cor.');
  const data = await image.rotate().resize(24,36,{fit:'fill',kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  return paletteFromPixels(data);
}
let active = 0; const waiting = [];
async function extractCoverPalette(source, options) {
  if (active >= 2) {
    if (waiting.length >= 64) throw new Error('Aguarde para processar mais capas.');
    await new Promise(resolve => waiting.push(resolve));
  } else active++;
  try { return await readCoverPalette(source, options); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}
module.exports = { allowedCoverHost, extractCoverPalette, paletteFromPixels };
