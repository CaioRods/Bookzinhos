let observer: IntersectionObserver | null = null;
const pending = new Map<Element, () => void>();

/** A single observer defers full-size theme images until their cards approach view. */
export function observeArtwork(element: Element, show: () => void) {
  if (typeof IntersectionObserver === "undefined") { show(); return () => {}; }
  observer ||= new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const reveal = pending.get(entry.target);
      pending.delete(entry.target);
      observer?.unobserve(entry.target);
      reveal?.();
    }
    if (!pending.size) { observer?.disconnect(); observer = null; }
  }, { rootMargin: "160px" });
  pending.set(element, show);
  observer.observe(element);
  return () => {
    pending.delete(element);
    observer?.unobserve(element);
    if (!pending.size) { observer?.disconnect(); observer = null; }
  };
}
