import { useRef } from "react";
import { ThemeImage, sourceSize } from "./ThemeImage";
import type { ImageCrop, SceneTheme } from "../lib/appearance";
const clamp = (value: number) => Math.max(0, Math.min(100, value));
export function CropEditor({ theme, value, onChange, label, surface = "profile", opacity = 1 }: { theme: SceneTheme; value: ImageCrop; onChange: (value: ImageCrop) => void; label: string; surface?: "profile" | "sidebar" | "book"; opacity?: number }) {
  const drag = useRef<{ x: number; y: number; crop: ImageCrop; travelX: number; travelY: number } | null>(null);
  return <fieldset className="mb-crop-editor"><legend>{label}</legend><p>Arraste a imagem ou ajuste posição e zoom.</p>
    <div className={`mb-crop-frame is-${surface}`} tabIndex={0} role="img" aria-label={`Prévia interativa: ${label}`} style={{ touchAction: "none" }}
      onPointerDown={event => { const bounds = event.currentTarget.getBoundingClientRect(), source = sourceSize(theme); const scale = Math.max(bounds.width / source.width, bounds.height / source.height) * value.zoom; drag.current = { x: event.clientX, y: event.clientY, crop: value, travelX: source.width * scale - bounds.width, travelY: source.height * scale - bounds.height }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { const start = drag.current; if (!start) return; onChange({ ...value, x: start.travelX > 1 ? clamp(start.crop.x - (event.clientX - start.x) / start.travelX * 100) : value.x, y: start.travelY > 1 ? clamp(start.crop.y - (event.clientY - start.y) / start.travelY * 100) : value.y }); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onKeyDown={event => { const offsets: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }; if (offsets[event.key]) { event.preventDefault(); const [dx, dy] = offsets[event.key]; onChange({ ...value, x: clamp(value.x + dx), y: clamp(value.y + dy) }); } }}>
      <div style={{ opacity }}><ThemeImage theme={theme} crop={value} /></div><span className="mb-crop-guides" aria-hidden="true" />
    </div>
    <div className="mb-crop-sliders">{[{ key: "x", text: "Horizontal", min: 0, max: 100, step: 1 }, { key: "y", text: "Vertical", min: 0, max: 100, step: 1 }, { key: "zoom", text: "Zoom", min: 1, max: 4, step: .05 }].map(control => <label key={control.key}>{control.text}<input type="range" aria-label={`${label}: ${control.text}`} min={control.min} max={control.max} step={control.step} value={value[control.key as keyof ImageCrop]} onChange={event => onChange({ ...value, [control.key]: Number(event.target.value) })} /><output>{control.key === "zoom" ? `${value.zoom.toFixed(2)}×` : `${Math.round(value[control.key as keyof ImageCrop])}%`}</output></label>)}</div>
  </fieldset>;
}
