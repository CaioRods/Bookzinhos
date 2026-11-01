import { API_BASE_URL } from "./config";
/**
 * Cor dominante da capa de um livro.
 *
 * O modo estante mostra só a lombada, e a lombada precisa parecer a mesma
 * edição da capa. Em vez de escolher uma cor arbitrária, amostramos a própria
 * imagem: reduzimos a capa a uns poucos pixels num canvas, ignoramos os quase
 * brancos e quase pretos (que costumam ser fundo e texto) e ficamos com o tom
 * mais presente. O resultado é guardado em cache para não repetir o trabalho.
 */

export interface SpineColor {
  /** Cor de base da lombada */
  base: string;
  /** Tom escurecido, para as bordas e o degradê */
  shade: string;
  /** Tom claro, para o brilho superior */
  tint: string;
  /** Cor de texto legível sobre `base` */
  ink: string;
}

function paletteFromRgb(r: number, g: number, b: number): SpineColor {
  const hex = (channels: number[]) => `#${channels.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
  const channels = [r, g, b];
  return { base: hex(channels), shade: hex(channels.map(value => value * .72)), tint: hex(channels.map(value => value + (255 - value) * .2)), ink: r * .2126 + g * .7152 + b * .0722 > 155 ? "#171717" : "#ffffff" };
}
export const NEUTRAL_COVER_COLOR = paletteFromRgb(105, 109, 113);
/** Select an actual image color. A substantial colored accent may stand out over gray. */
export function dominantCoverColor(data: Uint8ClampedArray | Uint8Array): SpineColor {
  type Bucket = { count: number; r: number; g: number; b: number };
  const all = new Map<string, Bucket>(), accents = new Map<string, Bucket>(); let total = 0;
  const add = (buckets: Map<string, Bucket>, key: string, r: number, g: number, b: number) => {
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 }; bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b; buckets.set(key, bucket);
  };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2], [h, s, l] = rgbToHsl(r, g, b); total++;
    add(all, `${Math.round(r / 24)}:${Math.round(g / 24)}:${Math.round(b / 24)}`, r, g, b);
    if (s >= 25 && l >= 10 && l <= 90) add(accents, `${Math.round(h / 12) % 30}`, r, g, b);
  }
  const largest = (buckets: Map<string, Bucket>) => [...buckets.values()].sort((a,b) => b.count - a.count)[0];
  const accent = largest(accents), dominant = accent && accent.count / total >= .08 ? accent : largest(all);
  if (!dominant) return NEUTRAL_COVER_COLOR;
  const average = [dominant.r / dominant.count, dominant.g / dominant.count, dominant.b / dominant.count];
  let sample = [0, 0, 0], distance = Infinity;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const next = (data[i] - average[0]) ** 2 + (data[i + 1] - average[1]) ** 2 + (data[i + 2] - average[2]) ** 2;
    if (next < distance) { distance = next; sample = [data[i], data[i + 1], data[i + 2]]; }
  }
  return paletteFromRgb(sample[0], sample[1], sample[2]);
}

const memory = new Map<string, SpineColor>();
const pending = new Map<string, Promise<SpineColor>>();
const STORAGE_KEY = "mybooks-spine-colors-v6";

/** Paleta de reserva para livros sem imagem de capa, por gradiente cadastrado. */
const FALLBACK_HUES: Record<string, number> = {
  "lavender-mint": 272,
  "peach-lavender": 22,
  "mint-sky": 168,
  "blush-lavender": 340,
  "peach-mint": 14,
  "lemon-peach": 44,
  "sky-mint": 205,
  "lavender-peach": 288,
  "mint-peach": 158,
  "blush-mint": 350,
};

function loadStore(): Record<string, SpineColor> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveToStore(key: string, value: SpineColor): void {
  try {
    const store = loadStore();
    store[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* cache é conveniência: sem espaço, seguimos sem ele */
  }
}

function fromHsl(h: number, s: number, l: number): SpineColor {
  return {
    base: `hsl(${h} ${s}% ${l}%)`,
    shade: `hsl(${h} ${Math.min(s + 6, 92)}% ${Math.max(l - 16, 8)}%)`,
    tint: `hsl(${h} ${Math.max(s - 8, 12)}% ${Math.min(l + 16, 92)}%)`,
    ink: l > 62 ? `hsl(${h} 45% 16%)` : "#ffffff",
  };
}

/** Cor determinística a partir do gradiente cadastrado (ou do id do livro). */
export function fallbackSpineColor(coverColor?: string | null, seed = ""): SpineColor {
  let hue = coverColor ? FALLBACK_HUES[coverColor] : undefined;
  if (hue == null) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
    hue = hash;
  }
  return fromHsl(hue, 26, 39);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h * 360, s * 100, l * 100];
}

/**
 * Extrai a cor dominante da capa. Nunca rejeita: se a imagem não puder ser lida
 * (offline, CORS bloqueado, formato estranho), devolve a cor de reserva.
 */
export function getSpineColor(
  coverUrl: string | null | undefined,
  coverColor?: string | null,
  seed = "",
  bookId?: string
): Promise<SpineColor> {
  const fallback = coverUrl ? NEUTRAL_COVER_COLOR : fallbackSpineColor(coverColor, seed);
  if (!coverUrl) return Promise.resolve(fallback);

  const cached = memory.get(coverUrl);
  if (cached) return Promise.resolve(cached);

  const stored = loadStore()[coverUrl];
  if (stored) {
    memory.set(coverUrl, stored);
    return Promise.resolve(stored);
  }

  const running = pending.get(coverUrl);
  if (running) return running;

  const task = new Promise<SpineColor>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    const finish = (color: SpineColor) => {
      memory.set(coverUrl, color);
      saveToStore(coverUrl, color);
      pending.delete(coverUrl);
      resolve(color);
    };

    const recover = async () => {
      if (bookId) {
        try {
          const response = await fetch(`${API_BASE_URL}/books/${encodeURIComponent(bookId)}/cover-palette`, { credentials: "include", signal: AbortSignal.timeout(12000) });
          if (!response.ok) throw new Error("Capa indisponível");
          const palette = await response.json();
          if (!["base", "shade", "tint", "ink"].every(key => /^#[a-f0-9]{6}$/i.test(palette[key]))) throw new Error("Cor inválida");
          finish(palette); return;
        } catch { /* Keep a neutral fallback only when both extraction paths fail. */ }
      }
      pending.delete(coverUrl); resolve(fallback);
    };
    img.onerror = () => { void recover(); };

    img.onload = () => {
      try {
        const W = 24;
        const H = 36;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { void recover(); return; }

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        finish(dominantCoverColor(data));
      } catch {
        // getImageData falha em canvas "sujo" (imagem sem CORS liberado).
        void recover();
      }
    };

    img.src = coverUrl;
  });

  pending.set(coverUrl, task);
  return task;
}
