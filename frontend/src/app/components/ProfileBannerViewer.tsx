import * as Dialog from "@radix-ui/react-dialog";
import { Maximize, Minus, Plus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { CENTER_CROP, type SceneTheme } from "../lib/appearance";
import { imageCropRect } from "../lib/imageCrop";
import { sourceSize, ThemeImage } from "./ThemeImage";

const MAX_ZOOM = 4;
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(1, value));

export function ProfileBannerViewer({ theme }: { theme: SceneTheme }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className="mb-profile-banner-trigger"
          data-public-banner-view
          data-banner-src={theme.imageUrl}
          data-banner-name={theme.name}
          aria-label="Ver banner inteiro"
        >
          <span><Maximize size={17} aria-hidden="true" /></span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mb-banner-viewer-overlay" />
        <Dialog.Content className="mb-banner-viewer" data-public-banner-view aria-describedby={undefined}>
          <BannerArtwork theme={theme} trigger={trigger} onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BannerArtwork({ theme, trigger, onClose }: {
  theme: SceneTheme;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const source = sourceSize(theme);

  useLayoutEffect(() => {
    const origin = trigger.current?.getBoundingClientRect();
    const destination = frame.current?.getBoundingClientRect();
    if (!origin?.width || !origin.height || !destination?.width || !image.current?.animate) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true") return;

    const crop = imageCropRect(source, origin, theme.profile);
    const scale = origin.width / crop.width;
    const left = origin.left - crop.left * scale;
    const top = origin.top - crop.top * scale;
    const inset = [
      crop.top / source.height,
      1 - (crop.left + crop.width) / source.width,
      1 - (crop.top + crop.height) / source.height,
      crop.left / source.width,
    ].map((edge) => `${Math.max(0, edge) * 100}%`).join(" ");
    const animation = image.current.animate([
      { transform: `translate(${left - destination.left}px, ${top - destination.top}px) scale(${scale * source.width / destination.width})`, clipPath: `inset(${inset} round 18px)` },
      { transform: "none", clipPath: "inset(0% round 12px)" },
    ], { duration: 440, easing: "cubic-bezier(.22,.8,.25,1)" });
    return () => animation.cancel();
  }, [trigger, source.width, source.height, theme.profile.x, theme.profile.y, theme.profile.zoom]);

  useLayoutEffect(() => {
    const element = stage.current;
    if (element) element.scrollTo({
      left: zoom === 1 ? 0 : (element.scrollWidth - element.clientWidth) / 2,
      top: zoom === 1 ? 0 : (element.scrollHeight - element.clientHeight) / 2,
      behavior: "instant",
    });
  }, [zoom]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    function wheel(event: WheelEvent) {
      if (event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      setZoom((value) => clampZoom(value + (event.deltaY < 0 ? .25 : -.25)));
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  return (
    <>
      <Dialog.Title className="sr-only">{theme.name} — banner inteiro</Dialog.Title>
      <div
        ref={stage}
        className="mb-banner-viewer-stage"
        data-zoomed={zoom > 1}
        onDoubleClick={() => setZoom((value) => value > 1 ? 1 : 2)}
        onPointerDown={(event) => {
          if (zoom === 1 || event.pointerType !== "mouse" || event.button !== 0) return;
          const element = event.currentTarget;
          element.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
        }}
        onPointerMove={(event) => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
          event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
        }}
        onLostPointerCapture={() => { drag.current = null; }}
        onTouchStart={(event) => {
          if (event.touches.length !== 2) return;
          const [a, b] = Array.from(event.touches);
          pinch.current = { distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), zoom };
        }}
        onTouchMove={(event) => {
          if (!pinch.current || event.touches.length !== 2) return;
          const [a, b] = Array.from(event.touches);
          const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          setZoom(clampZoom(pinch.current.zoom * distance / pinch.current.distance));
        }}
        onTouchEnd={() => { pinch.current = null; }}
        onTouchCancel={() => { pinch.current = null; }}
      >
        <div className="mb-banner-viewer-canvas" onClick={(event) => {
          if (zoom === 1 && event.target === event.currentTarget) onClose();
        }}>
          <div
            ref={frame}
            className="mb-banner-viewer-frame"
            style={{ "--banner-ratio": source.width / source.height, "--banner-zoom": zoom } as CSSProperties}
          >
            <div ref={image} className="mb-banner-viewer-art" role="img" aria-label={theme.name}>
              <ThemeImage theme={theme} crop={CENTER_CROP} referenceSize={source} />
            </div>
          </div>
        </div>
      </div>
      <Dialog.Close asChild>
        <button type="button" className="mb-banner-viewer-close" aria-label="Fechar visualização"><X size={22} /></button>
      </Dialog.Close>
      <div className="mb-banner-viewer-controls" role="group" aria-label="Zoom do banner">
        <button type="button" aria-label="Diminuir zoom" disabled={zoom <= 1} onClick={() => setZoom(clampZoom(zoom - .25))}><Minus size={20} /></button>
        <button type="button" aria-label="Redefinir zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="Aumentar zoom" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(clampZoom(zoom + .25))}><Plus size={20} /></button>
      </div>
    </>
  );
}
