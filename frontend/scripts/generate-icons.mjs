/**
 * Gera os ícones PNG do myBooks a partir da mesma marca do `public/logo.svg`.
 *
 * O SVG resolve favicon e interface, mas iOS e o manifesto do PWA ainda pedem
 * PNG. Em vez de depender de uma ferramenta externa, desenhamos a marca aqui
 * com supersampling e escrevemos o PNG na mão — assim o ícone pode ser
 * regerado a qualquer momento com `npm run icons`.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const SS = 4; // amostras por eixo

// ─── Cor ──────────────────────────────────────────────────────────────────────

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Gradiente de várias paradas ao longo de t ∈ [0,1]. */
function ramp(stops, t) {
  const clamped = Math.min(Math.max(t, 0), 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (clamped <= p1) return mix(c0, c1, (clamped - p0) / (p1 - p0 || 1));
  }
  return stops[stops.length - 1][1];
}

// ─── Formas ───────────────────────────────────────────────────────────────────

/** Retângulo de cantos arredondados, opcionalmente girado em torno de um ponto. */
function roundRect(x, y, w, h, r, rotation = 0, cx = 0, cy = 0) {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return (px, py) => {
    let qx = px;
    let qy = py;
    if (rotation) {
      const dx = px - cx;
      const dy = py - cy;
      qx = cx + dx * cos - dy * sin;
      qy = cy + dx * sin + dy * cos;
    }
    if (qx < x || qx > x + w || qy < y || qy > y + h) return false;
    const ix = Math.min(Math.max(qx, x + r), x + w - r);
    const iy = Math.min(Math.max(qy, y + r), y + h - r);
    return (qx - ix) ** 2 + (qy - iy) ** 2 <= r * r;
  };
}

// ─── Desenho ──────────────────────────────────────────────────────────────────

function drawLogo(size) {
  const W = size * SS;
  const u = W / 512;
  const out = Buffer.alloc(size * size * 4);
  const background = roundRect(0, 0, W, W, 116 * u);
  // These are the same optical bounds as public/logo.svg.
  const books = [
    roundRect(132*u,162*u,48*u,204*u,13*u),
    roundRect(202*u,126*u,48*u,240*u,13*u),
    roundRect(326*u,154*u,48*u,212*u,13*u,-14*Math.PI/180,350*u,366*u),
    roundRect(120*u,388*u,272*u,12*u,6*u),
  ];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r=0,g=0,b=0,a=0;
    for (let sy=0; sy<SS; sy++) for (let sx=0; sx<SS; sx++) {
      const px=x*SS+sx+.5, py=y*SS+sy+.5;
      if (!background(px,py)) continue;
      const color = books.some(shape => shape(px,py)) ? hex('#fffaf2') : mix(hex('#c87552'),hex('#a54b2f'),Math.min(1,(px*.7+py)/(W*1.7)));
      r+=color[0];g+=color[1];b+=color[2];a+=255;
    }
    const i=(y*size+x)*4, n=SS*SS;
    out[i]=Math.round(r/n);out[i+1]=Math.round(g/n);out[i+2]=Math.round(b/n);out[i+3]=Math.round(a/n);
  }
  return out;
}

// ─── PNG ──────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bits por canal
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compressão
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // sem entrelaçamento

  // Cada linha começa com o byte de filtro (0 = nenhum)
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Saída ────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, size] of [
  ["icon-1024.png", 1024],
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["favicon-64.png", 64],
]) {
  const png = encodePng(size, drawLogo(size));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`✓ ${name} (${size}×${size}, ${(png.length / 1024).toFixed(1)} kB)`);
}

// Expo uses the same master mark as the web application.
const NATIVE_ASSETS = join(OUT_DIR, "..", "..", "assets");
mkdirSync(NATIVE_ASSETS, { recursive: true });
for (const [source, destination] of [["icon-1024.png", "icon.png"], ["icon-1024.png", "adaptive-icon.png"], ["icon-512.png", "splash.png"], ["favicon-64.png", "favicon.png"]]) {
  copyFileSync(join(OUT_DIR, source), join(NATIVE_ASSETS, destination));
}
