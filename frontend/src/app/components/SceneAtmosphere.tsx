import { useLayoutEffect, useState, type CSSProperties } from "react";
import { useLocation } from "react-router";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage, type SceneAnchor } from "./ThemeImage";

/** Shares the sidebar's crop and scale: the outer scenery continues across the frame. */
export function SceneAtmosphere({ theme }: { theme: SceneTheme }) {
  const { pathname } = useLocation();
  const [anchor, setAnchor] = useState<SceneAnchor | undefined>();
  useLayoutEffect(() => {
    const artwork = document.querySelector<HTMLElement>(".mb-sidebar-art");
    if (!artwork) return;
    const measure = () => {
      const rect = artwork.getBoundingClientRect();
      if (rect.width && rect.height)
        setAnchor({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      else setAnchor(undefined);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(artwork);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pathname, theme.id]);

  return (
    <div
      className="mb-scene-atmosphere"
      aria-hidden="true"
      style={{ "--scene-intensity": theme.sidebarOpacity } as CSSProperties}
    >
      <div className="mb-scene-diffusion">
        <ThemeImage theme={theme} crop={theme.sidebar} />
      </div>
      <div className="mb-scene-continuation">
        <ThemeImage
          theme={theme}
          crop={theme.sidebar}
          continuationAnchor={anchor}
        />
      </div>
      <div className="mb-scene-veil" />
    </div>
  );
}
