import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trackBanner } from "../lib/api";
import { getFullUrl } from "../lib/types";
import type { Banner } from "../lib/types";

/**
 * Carrossel de banners da home.
 *
 * Os banners são criados pelo Admin (imagem própria, título ou os dois) e
 * aparecem para todo mundo. Gira sozinho, mas para enquanto o ponteiro está em
 * cima e quando a aba não está visível.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  // Um banner conta uma exibição por sessão, não uma por passagem do carrossel:
  // senão o relatório do patrocinador vira contagem de rotação, não de gente.
  const contados = useRef<Set<number>>(new Set());

  const total = banners.length;

  const go = useCallback((next: number) => {
    if (total === 0) return;
    setIndex(((next % total) + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || paused) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % total);
    }, 6000);
    return () => window.clearInterval(id);
  }, [total, paused]);

  // Só conta como exibição o banner que está de fato na tela e visível.
  const atual = total > 0 ? banners[index % total] : null;
  useEffect(() => {
    if (!atual || document.visibilityState !== "visible") return;
    if (contados.current.has(atual.id)) return;
    contados.current.add(atual.id);
    trackBanner(atual.id, "view");
  }, [atual]);

  if (total === 0) return null;

  const openBanner = (banner: Banner) => {
    trackBanner(banner.id, "click");
    if (banner.bookId) navigate(`/book/${banner.bookId}`);
    else if (banner.linkUrl) {
      if (banner.linkUrl.startsWith("/")) navigate(banner.linkUrl);
      else window.open(banner.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow-1)]">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => {
            const image = getFullUrl(banner.imageUrl);
            const clickable = !!(banner.bookId || banner.linkUrl);
            return (
              <div
                key={banner.id}
                data-banner-src={image || undefined} data-banner-name={banner.title || "banner"}
                onClick={() => clickable && openBanner(banner)}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={(e) => clickable && e.key === "Enter" && openBanner(banner)}
                className={`relative w-full flex-shrink-0 aspect-[16/7] sm:aspect-[3/1] bg-[var(--surface-2)] ${
                  clickable ? "cursor-pointer" : ""
                }`}
              >
                {image ? (
                  <img
                    src={image}
                    alt={banner.title || "Banner"}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--lavender)] via-[var(--blush)] to-[var(--peach)]" />
                )}

                {(banner.title || banner.subtitle) && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-10 max-w-[85%] sm:max-w-[60%]">
                      {banner.title && (
                        <h2 className="text-white text-lg sm:text-3xl font-bold leading-tight drop-shadow-sm">
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p className="text-white/85 text-[12.5px] sm:text-[15px] mt-1.5 sm:mt-2.5 leading-snug line-clamp-2">
                          {banner.subtitle}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {total > 1 && (
        <>
          <button
            onClick={() => go(index - 1)}
            aria-label="Banner anterior"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 text-white items-center justify-center backdrop-blur-sm transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(index + 1)}
            aria-label="Próximo banner"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 text-white items-center justify-center backdrop-blur-sm transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => go(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
