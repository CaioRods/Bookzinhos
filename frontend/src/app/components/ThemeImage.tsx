import { useEffect, useRef, useState } from "react";
import type { SceneTheme, ImageCrop } from "../lib/appearance";
import { getFullUrl } from "../lib/types";
export function sourceSize(theme: SceneTheme) { return theme.atlas ? { width: 768, height: 1024 / 3 } : { width: theme.width || 1536, height: theme.height || 1024 }; }
export function ThemeImage({ theme, crop, className = "" }: { theme: SceneTheme; crop: ImageCrop; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState({ width: 1000, height: 190 });
  useEffect(() => {
    const element = ref.current; if (!element) return;
    const measure = () => { const bounds = element.getBoundingClientRect(); if (bounds.width && bounds.height) setFrame({ width: bounds.width, height: bounds.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect();
  }, []);
  const source = sourceSize(theme);
  const scale = Math.max(frame.width / source.width, frame.height / source.height) * crop.zoom;
  const width = frame.width / scale, height = frame.height / scale;
  const x = Math.max(0, source.width - width) * crop.x / 100, y = Math.max(0, source.height - height) * crop.y / 100;
  return <svg ref={ref} aria-hidden="true" className={`mb-scenery ${className}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="none">
    <image href={theme.imageUrl.startsWith("/scenery/") ? theme.imageUrl : getFullUrl(theme.imageUrl) || ""} x={theme.atlas ? -theme.atlas.column * 768 : 0} y={theme.atlas ? -theme.atlas.row * 1024 / 3 : 0} width={theme.atlas ? 1536 : source.width} height={theme.atlas ? 1024 : source.height} />
  </svg>;
}
