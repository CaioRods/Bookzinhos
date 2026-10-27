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

const memory = new Map<string, SpineColor>();
const pending = new Map<string, Promise<SpineColor>>();
const STORAGE_KEY = "mybooks-spine-colors-v3";

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
  seed = ""
): Promise<SpineColor> {
  const fallback = fallbackSpineColor(coverColor, seed);
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

    img.onerror = () => {
      pending.delete(coverUrl);
      resolve(fallback);
    };

    img.onload = () => {
      try {
        const W = 24;
        const H = 36;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return finish(fallback);

        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        // Agrupa por faixa de matiz, pesando pela saturação: um detalhe vivo
        // pesa mais que uma área grande de bege lavado.
        const buckets = new Map<number, { weight: number; h: number; s: number; l: number }>();
        let total = 0;
        let sumL = 0;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          total += 1;
          sumL += l;
          if (l > 94 || l < 6) continue;

          const key = Math.round(h / 18);
          const weight = 1 + (s / 100) * 2.2;
          const slot = buckets.get(key) || { weight: 0, h: 0, s: 0, l: 0 };
          slot.weight += weight;
          slot.h += h * weight;
          slot.s += s * weight;
          slot.l += l * weight;
          buckets.set(key, slot);
        }

        if (buckets.size === 0 || total === 0) {
          // Capa praticamente monocromática: usa o brilho médio como cinza.
          const avg = total ? sumL / total : 50;
          return finish(fromHsl(26, 34, Math.min(Math.max(avg, 26), 54)));
        }

        let best = [...buckets.values()][0];
        for (const slot of buckets.values()) if (slot.weight > best.weight) best = slot;

        const h = best.h / best.weight;
        // Um piso de saturação alto mantém a estante colorida mesmo quando a
        // capa é discreta — lombadas acinzentadas somem umas nas outras.
        const s = Math.min(Math.max(best.s / best.weight * 1.25, 42), 88);
        // A lombada precisa de contraste com o texto: prendemos a luminosidade
        // numa faixa média, senão vira uma tira branca ou preta.
        const l = Math.min(Math.max(best.l / best.weight, 28), 55);

        finish(fromHsl(Math.round(h), Math.round(s), Math.round(l)));
      } catch {
        // getImageData falha em canvas "sujo" (imagem sem CORS liberado).
        pending.delete(coverUrl);
        resolve(fallback);
      }
    };

    img.src = coverUrl;
  });

  pending.set(coverUrl, task);
  return task;
}
