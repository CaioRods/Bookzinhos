export interface ImageCrop { x: number; y: number; zoom: number }
export interface SceneTheme {
  id: string; name: string; scope: "system" | "personal";
  imageUrl: string; width: number; height: number;
  atlas?: { column: number; row: number } | null;
  mainColor: string; profile: ImageCrop; sidebar: ImageCrop; sidebarOpacity: number;
  reference?: { bookId: string; saga: string } | null;
  updatedAt?: number;
}
export interface BookAppearance { width: number; height: number; imageUrl: string; mainColor: string | null; blur: number; opacity: number; crop: ImageCrop }
export const CENTER_CROP: ImageCrop = { x: 50, y: 50, zoom: 1 };
export const DEFAULT_BOOK_APPEARANCE: BookAppearance = { width: 800, height: 1200, imageUrl: "", mainColor: null, blur: 28, opacity: .22, crop: { ...CENTER_CROP } };
export function accentVariables(color: string, dark = false): Record<string, string> {
  const rgb = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!rgb) return {};
  let channels = rgb.slice(1).map(value => parseInt(value, 16));
  const luminance = (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722) / 255;
  if (dark && luminance < .6) channels = channels.map(value => Math.round(value + (255 - value) * .45));
  if (!dark && luminance > .65) channels = channels.map(value => Math.round(value * .55));
  const main = `#${channels.map(value => value.toString(16).padStart(2, "0")).join("")}`;
  const light = (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722) > 155;
  return { "--primary": main, "--accent": main, "--primary-hover": `color-mix(in srgb, ${main} 85%, ${dark ? "white" : "black"})`, "--primary-deep": main, "--primary-soft": `color-mix(in srgb, ${main} 12%, transparent)`, "--primary-foreground": light ? "#211526" : "#ffffff", "--ring": `color-mix(in srgb, ${main} 22%, transparent)` };
}

export function colorToHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const match = value.match(/hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/);
  if (!match) return "#64344f";
  const hue = Number(match[1]) / 30, saturation = Number(match[2]) / 100, lightness = Number(match[3]) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = lightness - chroma / 2;
  const channels = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${channels.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}
