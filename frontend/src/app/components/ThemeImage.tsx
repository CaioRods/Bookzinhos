import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneTheme, ImageCrop } from "../lib/appearance";
import { getFullUrl } from "../lib/types";
import { imageCropRect } from "../lib/imageCrop";
import { observeArtwork } from "../lib/lazyArtwork";
export interface SceneAnchor { x: number; y: number; width: number; height: number }
export function sourceSize(theme: SceneTheme) { return theme.atlas ? { width: 768, height: 1024 / 3 } : { width: theme.width || 1536, height: theme.height || 1024 }; }
export const ThemeImage = memo(function ThemeImage({ theme, crop, className = "", continuationAnchor, referenceSize, lazy = false }: { theme: SceneTheme; crop: ImageCrop; className?: string; continuationAnchor?: SceneAnchor; referenceSize?: { width: number; height: number }; lazy?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState({ width: 1000, height: 190 });
  const [visible, setVisible] = useState(!lazy);
  useEffect(() => {
    if (!lazy || visible || !ref.current) return;
    return observeArtwork(ref.current, () => setVisible(true));
  }, [lazy, visible]);
  useLayoutEffect(() => {
    if (referenceSize && !continuationAnchor) return;
    const element = ref.current; if (!element) return;
    const measure = () => { const bounds = element.getBoundingClientRect(); if (bounds.width && bounds.height) setFrame(current => current.width === bounds.width && current.height === bounds.height ? current : { width: bounds.width, height: bounds.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect();
  }, [!!referenceSize, !!continuationAnchor]);
  const source = sourceSize(theme);
  const reference = continuationAnchor || referenceSize || frame;
  const scale = Math.max(reference.width / source.width, reference.height / source.height) * crop.zoom;
  const viewport = referenceSize && !continuationAnchor ? referenceSize : frame;
  const width = viewport.width / scale, height = viewport.height / scale;
  const rect = imageCropRect(source, reference, crop);
  const cropX = rect.left;
  const cropY = rect.top;
  const x = cropX - (continuationAnchor?.x || 0) / scale;
  const y = cropY - (continuationAnchor?.y || 0) / scale;
  return <svg data-banner-src={theme.imageUrl} data-banner-name={theme.name} ref={ref} aria-hidden="true" className={`mb-scenery ${className}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="none">
    {(!lazy || visible) && <image href={theme.imageUrl.startsWith("/scenery/") ? theme.imageUrl : getFullUrl(theme.imageUrl) || ""} x={theme.atlas ? -theme.atlas.column * 768 : 0} y={theme.atlas ? -theme.atlas.row * 1024 / 3 : 0} width={theme.atlas ? 1536 : source.width} height={theme.atlas ? 1024 : source.height} />}
  </svg>;
});
