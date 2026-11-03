import {loadProfileImage,profileImageFallback} from './profileImage';
import type { Book, ProgressionSummary, UserProfile } from "./types";
import { getFullUrl } from "./types";
import { colorToHex, type SceneTheme } from "./appearance";
import { imageCropRect } from "./imageCrop";

export interface ProfileCardInput {
  profile: UserProfile;
  books: Book[];
  theme: SceneTheme;
  progression?: ProgressionSummary | null;
  url: string;
}

const WIDTH = 1080;
const SANS = '"Plus Jakarta Sans Variable", sans-serif';
const SERIF = '"Literata", serif';

/** Accept remote images and raster data URLs; reject executable schemes and local blob URLs. */
function imageUrl(value?: string | null): string | null {
  if (!value || !/^(https?:\/\/|\/|data:image\/|[a-z\d_.-]+\/)/i.test(value)) return null;
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z\d+/=\s]+$/i.test(value)) return value;
  try {
    const resolved = new URL(value.startsWith("/scenery/") ? value : getFullUrl(value) || "", window.location.href);
    return ["http:", "https:"].includes(resolved.protocol) && !resolved.username && !resolved.password ? resolved.href : null;
  } catch { return null; }
}

/** Wrap even unbroken handles and CJK text without dropping Unicode code points. */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of String(text || "").split(/\r?\n/)) {
    let line = "";
    for (const token of paragraph.split(/(\s+)/)) {
      if (ctx.measureText(line + token).width <= width) { line += token; continue; }
      if (line.trim()) { result.push(line.trimEnd()); line = ""; }
      for (const point of Array.from(token.trimStart())) {
        if (line && ctx.measureText(line + point).width > width) { result.push(line); line = ""; }
        line += point;
      }
    }
    result.push(line.trimEnd());
  }
  return result;
}

function font(ctx: CanvasRenderingContext2D, size: number, display = false, weight = 500) {
  ctx.font = `${weight} ${size}px ${display ? SERIF : SANS}`;
}
function textBlock(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, lineHeight: number, display = false, weight = 500) {
  font(ctx, size, display, weight);
  const wrapped = lines(ctx, text, width);
  for (const line of wrapped) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}
function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / ratio, sh = h / ratio;
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
function pillFlow(ctx: CanvasRenderingContext2D, values: string[], y: number, accent: string, filled = false) {
  let x = 64, rowHeight = 0;
  font(ctx, 20);
  for (const value of values) {
    const wrapped = lines(ctx, value, 900);
    const w = Math.min(952, Math.max(...wrapped.map(line => ctx.measureText(line).width)) + 32);
    const h = wrapped.length * 28 + 22;
    if (x + w > 1016 && x > 64) { x = 64; y += rowHeight + 12; rowHeight = 0; }
    ctx.fillStyle = filled ? accent : `${accent}12`;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
    ctx.fillStyle = filled ? "#ffffff" : "#252330";
    wrapped.forEach((line, i) => ctx.fillText(line, x + 16, y + 11 + i * 28));
    x += w + 12; rowHeight = Math.max(rowHeight, h);
  }
  return y + rowHeight;
}

export async function renderProfileCard(input: ProfileCardInput): Promise<Blob> {
  const { profile, theme, progression } = input;
  await Promise.race([
    Promise.all([document.fonts.load(`600 60px ${SERIF}`), document.fonts.load(`500 28px ${SANS}`)]).catch(() => undefined),
    new Promise(resolve => setTimeout(resolve, 2500)),
  ]);
  const selected = new Set(profile.shelf || []);
  const byId = new Map(input.books.filter(book => book.isPublic === true && selected.has(book.id)).map(book => [book.id, book]));
  const books = [...selected].map(id => byId.get(id)).filter((book): book is Book => !!book).slice(0, 12);
  const [art, avatar, ...covers] = await Promise.all([loadProfileImage(imageUrl(theme.imageUrl), profileImageFallback(profile.username,'banner')), loadProfileImage(imageUrl(profile.avatar), profileImageFallback(profile.username,'avatar')), ...books.map(book => loadProfileImage(imageUrl(book.coverImagePath),profileImageFallback(profile.username,'cover',book.id)))]);
  const canvas = document.createElement("canvas"); canvas.width = WIDTH;
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar a imagem do perfil.");
  const sourceColor = colorToHex(theme.mainColor || "#67507e");
  const channels = sourceColor.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
  // Keep the scenery untouched while ensuring themed text has contrast on paper.
  const luminance = (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722) / 255;
  const accent = luminance > .55
    ? `#${channels.map(channel => Math.round(channel * .43).toString(16).padStart(2, "0")).join("")}`
    : sourceColor;
  const name = profile.displayName || profile.username || "Meu perfil";
  const handle = `@${(profile.handle || profile.username || "leitor").replace(/^@/, "")}`;
  const socials = [profile.instagram && `Instagram  @${profile.instagram.replace(/^@/, "")}`, profile.tiktok && `TikTok  @${profile.tiktok.replace(/^@/, "")}`].filter((s): s is string => !!s);
  const genres = (profile.favoriteGenres || []).filter(Boolean);
  const badges = (progression?.badges || []).map(badge => badge.name).filter(Boolean);
  // Measure the same flowing layout before allocating the final raster.
  function body(c: CanvasRenderingContext2D, paint: boolean): number {
    c.textBaseline = "top"; c.textAlign = "left"; c.fillStyle = "#252330";
    let y = 532;
    y = textBlock(c, name, 64, y, 952, 61, 76, true, 600);
    c.fillStyle = accent; y = textBlock(c, handle, 64, y + 6, 952, 26, 37, false, 650);
    if (profile.bio) { c.fillStyle = "#484550"; y = textBlock(c, profile.bio, 64, y + 28, 952, 27, 41); }
    if (socials.length) y = pillFlow(c, socials, y + 24, accent);
    y += 40;
    const metrics: [number, string][] = [
      [profile.stats?.uploaded ?? 0, "Adicionados"],
      [profile.stats?.reading ?? 0, "Lendo"],
      [profile.stats?.finished ?? profile.finishedCount ?? 0, "Lidos"],
      [profile.stats?.saved ?? 0, "Favoritos"],
      [profile.stats?.reviews ?? profile.reviewCount ?? 0, "Resenhas"],
      [profile.followers ?? 0, "Seguidores"],
      [profile.following ?? 0, "Seguindo"],
      [profile.pandinhas ?? 0, "Pandinhas"],
    ];
    if (paint) {
      c.fillStyle = `${accent}16`; c.beginPath(); c.roundRect(64, y, 952, 228, 22); c.fill();
      metrics.forEach(([value, label], index) => {
        const center = 64 + (index % 4 + .5) * 952 / 4;
        const rowY = y + Math.floor(index / 4) * 112;
        const count = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
        const formatted = new Intl.NumberFormat("pt-BR", count >= 1e9 ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(count);
        c.textAlign = "center"; c.fillStyle = "#252330"; font(c, 32, true, 600);
        // Fit even unusually large imported counts inside their own metric cell.
        c.fillText(formatted, center, rowY + 20, 210);
        font(c, 17); c.fillStyle = "#57505e"; c.fillText(label, center, rowY + 72, 210);
      }); c.textAlign = "left";
    }
    y += 262;
    if (genres.length) { c.fillStyle = "#252330"; y = textBlock(c, "Minhas histórias favoritas", 64, y, 952, 25, 36, true, 600); y = pillFlow(c, genres, y + 14, accent) + 30; }
    if (progression) {
      c.fillStyle = accent; y = textBlock(c, `Nível ${progression.level}  ·  ${progression.title}`, 64, y, 952, 29, 43, true, 600);
      if (badges.length) y = pillFlow(c, badges.map(badge => `✦ ${badge}`), y + 14, accent) + 12;
      y += 26;
    }
    c.fillStyle = "#252330"; y = textBlock(c, "Minha estante", 64, y + 6, 952, 40, 56, true, 600) + 22;
    if (!books.length) { c.fillStyle = "#686170"; y = textBlock(c, "Novas histórias estão por vir.", 64, y, 952, 25, 38) + 24; }
    for (let row = 0; row < Math.ceil(books.length / 6); row++) {
      let tallest = 0;
      books.slice(row * 6, row * 6 + 6).forEach((book, index) => {
        const x = 64 + index * 162, bookIndex = row * 6 + index;
        if (paint) {
          c.save(); c.beginPath(); c.roundRect(x, y, 142, 210, [5, 12, 12, 5]); c.clip();
          if (covers[bookIndex]) cover(c, covers[bookIndex]!, x, y, 142, 210);
          else {
            const gradient = c.createLinearGradient(x, y, x + 142, y + 210); gradient.addColorStop(0, accent); gradient.addColorStop(1, "#282638"); c.fillStyle = gradient; c.fillRect(x, y, 142, 210);
            c.fillStyle = "#ffffff"; textBlock(c, book.title, x + 14, y + 28, 112, 19, 27, true, 600);
          }
          c.fillStyle = "#ffffff25"; c.fillRect(x + 5, y, 3, 210); c.restore();
        }
        c.fillStyle = "#252330"; font(c, 18, false, 650);
        const titleHeight = lines(c, book.title, 142).length * 27;
        if (paint) textBlock(c, book.title, x, y + 224, 142, 18, 27, false, 650);
        tallest = Math.max(tallest, titleHeight);
      });
      y += 224 + tallest + 32;
    }
    return y + 30;
  }
  const bottom = body(ctx, false);
  font(ctx, 20); const linkLines = lines(ctx, input.url, 720);
  canvas.height = Math.ceil(Math.max(1600, bottom + 94 + linkLines.length * 29));
  ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, WIDTH, canvas.height);
  ctx.fillStyle = `${sourceColor}09`; ctx.fillRect(0, 0, WIDTH, canvas.height);
  const backdrop = ctx.createLinearGradient(0, 0, WIDTH, 400); backdrop.addColorStop(0, sourceColor); backdrop.addColorStop(1, "#282638"); ctx.fillStyle = backdrop; ctx.fillRect(0, 0, WIDTH, 400);
  if (art) {
    const source = theme.atlas ? { width: 768, height: 1024 / 3 } : { width: theme.width || 1536, height: theme.height || 1024 };
    const rect = imageCropRect(source, { width: WIDTH, height: 400 }, theme.profile);
    const atlasX = theme.atlas ? theme.atlas.column * 768 : 0, atlasY = theme.atlas ? theme.atlas.row * 1024 / 3 : 0;
    const scaleX = art.naturalWidth / (theme.atlas ? 1536 : source.width), scaleY = art.naturalHeight / (theme.atlas ? 1024 : source.height);
    ctx.drawImage(art, (atlasX + rect.left) * scaleX, (atlasY + rect.top) * scaleY, rect.width * scaleX, rect.height * scaleY, 0, 0, WIDTH, 400);
  }
  const shade = ctx.createLinearGradient(0, 220, 0, 400); shade.addColorStop(0, "#00000000"); shade.addColorStop(1, "#00000060"); ctx.fillStyle = shade; ctx.fillRect(0, 220, WIDTH, 180);
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(150, 416, 96, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(150, 416, 86, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = `${accent}22`; ctx.fillRect(64, 330, 172, 172);
  if (avatar) cover(ctx, avatar, 64, 330, 172, 172);
  else { ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = accent; font(ctx, 68, false, 650); ctx.fillText(imageUrl(profile.avatar) ? Array.from(name)[0] || "✦" : (profile.avatar || Array.from(name)[0] || "✦"), 150, 419, 145); }
  ctx.restore();
  const footerY = Math.max(bottom, canvas.height - 94 - linkLines.length * 29);
  body(ctx, true);
  ctx.strokeStyle = `${accent}35`; ctx.beginPath(); ctx.moveTo(64, footerY); ctx.lineTo(1016, footerY); ctx.stroke();
  ctx.fillStyle = "#50485c"; textBlock(ctx, input.url, 64, footerY + 27, 720, 20, 29);
  ctx.fillStyle = accent; ctx.textAlign = "right"; font(ctx, 32, false, 750); ctx.fillText("myBooks", 1016, footerY + 24);
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível exportar a imagem.")), "image/png"); }
    catch { reject(new Error("Não foi possível exportar a imagem. Tente novamente.")); }
  });
}
