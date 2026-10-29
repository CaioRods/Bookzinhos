import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { avatarSourceRect, cropToTransform, type Size } from "../lib/avatarCrop";

type Crop = { x: number; y: number; zoom: number };
const APERTURE = 240;
const STAGE = 320;
const INSET = (STAGE - APERTURE) / 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export async function cropAvatar(source: string, x: number, y: number, zoom: number): Promise<Blob> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const sourceSize = { width: image.naturalWidth, height: image.naturalHeight };
  const viewport = { width: APERTURE, height: APERTURE };
  const rect = avatarSourceRect(cropToTransform({ x, y, zoom }, sourceSize, viewport), sourceSize, viewport);
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 720;
  canvas.getContext("2d")!.drawImage(image, rect.left, rect.top, rect.width, rect.height, 0, 0, 720, 720);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível recortar a imagem.")),
    "image/webp",
    0.92,
  ));
}

export function AvatarCropper({ source, onChange }: { source: string; onChange: (crop: Crop) => void }) {
  const [crop, setCrop] = useState<Crop>({ x: 50, y: 50, zoom: 1 });
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ crop: Crop; x: number; y: number; distance: number } | null>(null);

  useEffect(() => onChange(crop), [crop, onChange]);
  useEffect(() => { setCrop({ x: 50, y: 50, zoom: 1 }); }, [source]);

  const transform = useMemo(() => imageSize
    ? cropToTransform(crop, imageSize, { width: APERTURE, height: APERTURE })
    : null, [crop, imageSize]);

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...pointers.current.values()];
    gesture.current = {
      crop,
      x: values[0].x,
      y: values[0].y,
      distance: values.length > 1 ? Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y) : 0,
    };
  };

  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !imageSize || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...pointers.current.values()];
    const start = gesture.current;
    if (values.length > 1 && start.distance > 0) {
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      setCrop((current) => ({ ...current, zoom: clamp(start.crop.zoom * distance / start.distance, 1, 4) }));
      return;
    }
    const startTransform = cropToTransform(start.crop, imageSize, { width: APERTURE, height: APERTURE });
    const travelX = Math.max(1, imageSize.width * startTransform.scale - APERTURE);
    const travelY = Math.max(1, imageSize.height * startTransform.scale - APERTURE);
    setCrop((current) => ({
      ...current,
      x: travelX <= 1 ? 50 : clamp(start.crop.x - (event.clientX - start.x) / travelX * 100, 0, 100),
      y: travelY <= 1 ? 50 : clamp(start.crop.y - (event.clientY - start.y) / travelY * 100, 0, 100),
    }));
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remaining = [...pointers.current.values()];
    gesture.current = remaining.length ? { crop, x: remaining[0].x, y: remaining[0].y, distance: 0 } : null;
  };

  const zoomByWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setCrop((current) => ({ ...current, zoom: clamp(current.zoom - event.deltaY * 0.002, 1, 4) }));
  };

  return (
    <div className="mb-avatar-cropper">
      <p>Arraste para enquadrar. Use a pinça ou a roda do mouse para aproximar.</p>
      <div
        className="mb-avatar-crop-stage"
        role="img"
        aria-label="Prévia interativa do recorte da foto de perfil"
        tabIndex={0}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onWheel={zoomByWheel}
        onKeyDown={(event) => {
          const movement: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] };
          if (movement[event.key]) {
            event.preventDefault();
            const [dx, dy] = movement[event.key];
            setCrop((current) => ({ ...current, x: clamp(current.x + dx, 0, 100), y: clamp(current.y + dy, 0, 100) }));
          } else if (event.key === "+" || event.key === "=") {
            setCrop((current) => ({ ...current, zoom: clamp(current.zoom + 0.1, 1, 4) }));
          } else if (event.key === "-") {
            setCrop((current) => ({ ...current, zoom: clamp(current.zoom - 0.1, 1, 4) }));
          }
        }}
      >
        <img
          src={source}
          alt=""
          draggable={false}
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          style={transform ? {
            width: imageSize!.width * transform.scale,
            height: imageSize!.height * transform.scale,
            transform: `translate3d(${INSET + transform.x}px, ${INSET + transform.y}px, 0)`,
          } : undefined}
        />
        <span className="mb-avatar-crop-mask" aria-hidden="true" />
      </div>
      <div className="mb-avatar-crop-controls">
        <label>Zoom
          <input type="range" min="1" max="4" step=".05" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))} />
          <output>{crop.zoom.toFixed(2)}×</output>
        </label>
        <button type="button" className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => setCrop({ x: 50, y: 50, zoom: 1 })}>Centralizar</button>
      </div>
    </div>
  );
}
