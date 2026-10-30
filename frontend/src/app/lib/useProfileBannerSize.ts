import { useLayoutEffect, useState } from "react";

export interface ProfileBannerSize {
  width: number;
  height: number;
}

/** The preview follows the rendered banner, including responsive and content-driven heights. */
export function useProfileBannerSize(enabled: boolean) {
  const [size, setSize] = useState<ProfileBannerSize | null>(null);
  useLayoutEffect(() => {
    if (!enabled) {
      setSize(null);
      return;
    }
    const banner = document.querySelector<HTMLElement>("[data-profile-banner]");
    if (!banner) return;
    const measure = () => {
      const { width, height } = banner.getBoundingClientRect();
      if (width > 0 && height > 0)
        setSize((current) =>
          current?.width === width && current?.height === height
            ? current
            : { width, height },
        );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);
  return enabled ? size : null;
}
