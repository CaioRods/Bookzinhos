import { useEffect, useRef, useState } from "react";

export async function cropAvatar(source: string, x: number, y: number, zoom: number): Promise<Blob> {
  const image = new Image(); image.src = source; await image.decode();
  const size = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const left = (image.naturalWidth - size) * x / 100;
  const top = (image.naturalHeight - size) * y / 100;
  const canvas = document.createElement("canvas"); canvas.width = 720; canvas.height = 720;
  canvas.getContext("2d")!.drawImage(image, left, top, size, size, 0, 0, 720, 720);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível recortar a imagem.")), "image/webp", .92));
}

export function AvatarCropper({ source, onChange }: { source: string; onChange: (crop: { x: number; y: number; zoom: number }) => void }) {
  const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  useEffect(() => onChange(crop), [crop, onChange]);
  return <div className="space-y-3"><div className="mx-auto w-52 aspect-square rounded-full overflow-hidden border-4 border-[var(--surface)] ring-1 ring-[var(--line)] touch-none" onPointerDown={(event) => { drag.current = { x: crop.x, y: crop.y, startX: event.clientX, startY: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current) return; setCrop((old) => ({ ...old, x: Math.max(0, Math.min(100, drag.current!.x - (event.clientX - drag.current!.startX) / 2)), y: Math.max(0, Math.min(100, drag.current!.y - (event.clientY - drag.current!.startY) / 2)) })); }} onPointerUp={() => { drag.current = null; }}><img src={source} alt="Prévia do recorte" className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} /></div><label className="mb-label">Zoom <input type="range" min="1" max="3" step=".05" value={crop.zoom} onChange={(event) => setCrop((old) => ({ ...old, zoom: Number(event.target.value) }))} className="w-full accent-[var(--primary)]" /></label></div>;
}
