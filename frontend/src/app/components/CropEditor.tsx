import { useProfileBannerSize } from "../lib/useProfileBannerSize";
import { useCropSurfaceSize, type CropSurface } from "../lib/useCropSurfaceSize";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeImage, sourceSize } from "./ThemeImage";
import { CropArtwork } from "./CropArtwork";
import { Modal } from "./Ui";
import { moveImageCrop } from "../lib/imageCrop";
import type { ImageCrop, SceneTheme } from "../lib/appearance";
import type { Size } from "../lib/avatarCrop";
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function CropEditor({ theme, value, onChange, label, surface = "profile", opacity = 1, blur = 0, backgroundColor, artwork, referenceSize, allowExpand = true }: {
  theme: SceneTheme; value: ImageCrop; onChange: (value: ImageCrop) => void; label: string;
  surface?: CropSurface; opacity?: number; blur?: number; backgroundColor?: string; artwork?: ReactNode; allowExpand?: boolean; referenceSize?: Size;
}) {
  const profileSize = useProfileBannerSize(!referenceSize && surface === "profile");
  const targetSize = useCropSurfaceSize(surface, !referenceSize && surface !== "profile");
  const fallback = surface === "folder" ? {width:280,height:300} : surface === "sidebar" ? { width: 248, height: 600 } : { width: 1400, height: surface === "profile" ? 420 : 250 };
  const reference = referenceSize || profileSize || targetSize || fallback;
  const [expanded, setExpanded] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; crop: ImageCrop; viewport: Size } | null>(null);
  const pending = useRef<ImageCrop | null>(null);
  const animation = useRef<number | null>(null);
  const change = useRef(onChange); change.current = onChange;
  const flush = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    if (pending.current) { const next = pending.current; pending.current = null; change.current(next); }
  };
  useEffect(() => () => { if (animation.current !== null) cancelAnimationFrame(animation.current); }, []);
  const finish = () => { flush(); drag.current = null; };
  const title = surface === "profile" ? "Ajustar recorte do perfil" : surface === "sidebar" ? "Ajustar recorte do menu" : surface === "folder" ? "Ajustar capa da Booklist" : "Ajustar recorte do banner";

  return <><fieldset className="mb-crop-editor"><legend>{label}</legend>
    <p>Arraste para enquadrar. A área dentro da moldura será exibida; a imagem suave ao redor fica fora do recorte.</p>
    <div className="mb-crop-workspace" tabIndex={0} role="img" aria-label={`Prévia interativa: ${label}`}
      onPointerDown={event => {
        if (drag.current || event.button !== 0 || !frame.current) return;
        const bounds = frame.current.getBoundingClientRect();
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, crop: value, viewport: { width: bounds.width, height: bounds.height } };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        pending.current = moveImageCrop(sourceSize(theme), start.viewport, start.crop, event.clientX - start.x, event.clientY - start.y);
        if (animation.current === null) animation.current = requestAnimationFrame(flush);
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onKeyDown={event => {
        const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!offsets[event.key]) return;
        event.preventDefault();
        const [dx, dy] = offsets[event.key], step = event.altKey ? .1 : event.shiftKey ? 5 : 1;
        onChange({ ...value, x: clamp(value.x + dx * step), y: clamp(value.y + dy * step) });
      }}>
      <div ref={frame} className={`mb-crop-frame is-${surface}`} style={{ width: "100%", height: "auto", aspectRatio: `${reference.width} / ${reference.height}`, minHeight: 0, maxWidth: `min(100%, calc(42dvh * ${reference.width / reference.height}))`, marginInline: "auto" }}>
        <div className="mb-crop-outside" aria-hidden="true"><ThemeImage theme={theme} crop={value} referenceSize={reference}/></div>
        <div className="mb-crop-inside" style={backgroundColor ? { backgroundColor } : undefined}>
          {artwork || <CropArtwork theme={theme} crop={value} surface={surface} opacity={opacity} blur={blur} referenceSize={reference}/>}
        </div>
        <span className="mb-crop-guides" aria-hidden="true" />
      </div>
    </div>
    <div className="mb-crop-sliders">{([{ key: "x", text: "Horizontal", min: 0, max: 100, step: .1 }, { key: "y", text: "Vertical", min: 0, max: 100, step: .1 }, { key: "zoom", text: "Zoom", min: 1, max: 4, step: .01 }] as const).map(control => <label key={control.key}>{control.text}<input type="range" aria-label={`${label}: ${control.text}`} min={control.min} max={control.max} step={control.step} value={value[control.key]} onChange={event => onChange({ ...value, [control.key]: Number(event.target.value) })} /><input className="mb-crop-number" type="number" aria-label={`${label}: ${control.text} exato`} min={control.min} max={control.max} step={control.step} value={Number(value[control.key].toFixed(2))} onChange={event => { const number = event.target.valueAsNumber; if (Number.isFinite(number)) onChange({ ...value, [control.key]: Math.min(control.max, Math.max(control.min, number)) }); }}/></label>)}</div>
    <div className="mb-crop-actions"><button type="button" className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => onChange({ x: 50, y: 50, zoom: 1 })}>Centralizar e redefinir zoom</button>{allowExpand && <button type="button" className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => setExpanded(true)}>Ampliar área de ajuste</button>}</div>
  </fieldset>{expanded && <Modal open title={title} description="A moldura mantém o mesmo enquadramento da área final." size="xl" onClose={() => setExpanded(false)} footer={<button type="button" className="mb-btn mb-btn-primary" onClick={() => setExpanded(false)}>Concluir ajuste</button>}><CropEditor theme={theme} value={value} onChange={onChange} label={label} surface={surface} opacity={opacity} blur={blur} backgroundColor={backgroundColor} artwork={artwork} referenceSize={referenceSize} allowExpand={false}/></Modal>}</>;
}
