/** Limit concurrent PDF.js jobs: visible tiles share the worker with page previews. */
let active = 0;
const waiting: (() => void)[] = [];
export async function schedulePdfRender<T>(render: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try { return await render(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export function pdfResolution(width: number, height: number, dpr: number, magnification: number, preview = false) {
  const density = Math.max(1, Math.min(dpr || 1, 3)) * Math.max(1, magnification);
  // Only the overview is capped. Detail tiles retain the zoom's actual resolution.
  return preview ? Math.min(density, Math.sqrt(1_000_000 / Math.max(1, width * height))) : density;
}
