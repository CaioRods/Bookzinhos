import { useLayoutEffect, useState } from "react";
import type { Size } from "./avatarCrop";

export type CropSurface = "profile" | "sidebar" | "book" | "banner" | "folder";
const selectors: Record<CropSurface, string> = {
  profile: "[data-profile-banner]",
  sidebar: ".mb-sidebar-art",
  book: ".mb-book-banner",
  banner: ".mb-book-banner",
  folder: ".mb-folder-art",
};

/** Measure the destination, never the modal or a scaled thumbnail. */
export function useCropSurfaceSize(surface: CropSurface, enabled = true) {
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    if (!enabled) { setSize(null); return; }
    let target: HTMLElement | null = null;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
    const measure = () => {
      const next = document.querySelector<HTMLElement>(selectors[surface]);
      if (next !== target) { if (target) observer?.disconnect(); target = next; if (target) observer?.observe(target); }
      const bounds = target?.getBoundingClientRect();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        setSize(current => current?.width === bounds.width && current.height === bounds.height ? current : { width: bounds.width, height: bounds.height });
      } else setSize(null);
    };
    measure();
    const discovery = new MutationObserver(() => { if (!target?.isConnected) measure(); });
    discovery.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); discovery.disconnect(); window.removeEventListener("resize", measure); };
  }, [surface, enabled]);
  return enabled ? size : null;
}
