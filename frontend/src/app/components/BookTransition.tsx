import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, type LinkProps } from "react-router";
import { Book3D } from "./Book3D";
import { getFullUrl, type Book } from "../lib/types";

interface Flight { book: Book; rect: { left: number; top: number; width: number }; coverWidth: number; startAngle: number }
type Launcher = (flight: Flight) => void;
const BookFlightContext = createContext<{ launch: Launcher | null; flyingId: string | null }>({ launch: null, flyingId: null });
export const useBookFlight = () => useContext(BookFlightContext).launch;
export const useFlyingBookId = () => useContext(BookFlightContext).flyingId;

export function BookTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  const launch = useCallback<Launcher>(next => setFlight(current => current || next), []);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true";
  const value = useMemo(() => ({ launch: reduced ? null : launch, flyingId: flight?.book.id || null }), [reduced, launch, flight]);
  return <BookFlightContext.Provider value={value}>{children}{flight && <FlyingBook flight={flight} navigate={() => navigate(`/book/${encodeURIComponent(flight.book.id)}`)} done={() => setFlight(null)}/>}</BookFlightContext.Provider>;
}

function FlyingBook({ flight, navigate, done }: { flight: Flight; navigate: () => void; done: () => void }) {
  const layer = useRef<HTMLDivElement>(null), cover = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ navigate, done }); callbacks.current = { navigate, done };
  useEffect(() => {
    let cancelled = false, target: HTMLElement | null = null, observer: MutationObserver | undefined;
    let observerTimer: number | undefined;
    const animations: Animation[] = [];
    const animate = (element: HTMLElement, frames: Keyframe[], duration: number) => {
      const animation = element.animate(frames, { duration, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }); animations.push(animation); return animation.finished;
    };
    const findTarget = () => Array.from(document.querySelectorAll<HTMLElement>("[data-book-cover]")).find(element => element.dataset.bookCover === flight.book.id) || null;
    const waitForTarget = () => new Promise<HTMLElement | null>(resolve => {
      const existing = findTarget(); if (existing) { resolve(existing); return; }
      observer = new MutationObserver(() => { const found = findTarget(); if (found) { observer?.disconnect(); clearTimeout(observerTimer); resolve(found); } });
      observer.observe(document.body, { childList: true, subtree: true });
      observerTimer = window.setTimeout(() => { observer?.disconnect(); resolve(null); }, 3500);
    });
    const run = async () => {
      const element = cover.current, backdrop = layer.current;
      if (!element || !backdrop) return;
      const width = Math.min(280, window.innerWidth * .48, window.innerHeight * .36), height = width * 1.5;
      const center = { left: `${(window.innerWidth-width)/2}px`, top: `${(window.innerHeight-height)/2}px`, width: `${width}px`, height: `${height}px`, transform: "rotateY(0deg)" };
      try {
        const first = animate(element, [{ left: `${flight.rect.left + flight.rect.width/2-flight.coverWidth/2}px`, top: `${flight.rect.top}px`, width: `${flight.coverWidth}px`, height: `${flight.coverWidth*1.5}px`, transform: `rotateY(${flight.startAngle}deg)` }, center], 720);
        callbacks.current.navigate();
        const destination = waitForTarget();
        await first;
        if (cancelled) return;
        target = await destination;
        if (cancelled) return;
        if (target) {
          const bounds = target.getBoundingClientRect();
          target.style.visibility = "hidden";
          await animate(element, [center, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, transform: "rotateY(0deg)" }], 650);
          if (cancelled) return;
          target.style.visibility = "";
        }
        await animate(backdrop, [{ opacity: 1 }, { opacity: 0 }], 220);
      } catch { /* Cancelamento de animação: a navegação continua disponível. */ }
      if (!cancelled) callbacks.current.done();
    };
    void run();
    return () => { cancelled = true; observer?.disconnect(); clearTimeout(observerTimer); animations.forEach(animation => animation.cancel()); if (target) target.style.visibility = ""; };
  }, [flight]);
  const image = getFullUrl(flight.book.coverImagePath);
  return createPortal(<div ref={layer} className="mb-book-flight" aria-hidden="true"><div className="mb-book-flight-backdrop"/><div className="mb-book-waves"><i/><i/><i/></div><div className="mb-book-flight-cover" ref={cover}>{image ? <img src={image} alt=""/> : <Book3D book={flight.book} width={flight.coverWidth} still/>}</div></div>, document.body);
}

/** Reuses the same cover flight for editorial, related-book and saga links. */
export function AnimatedBookLink({ book, onClick, ...props }: { book: Book } & Omit<LinkProps, "to">) {
  const launch = useBookFlight();
  return <Link {...props} to={`/book/${encodeURIComponent(book.id)}`} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || !launch || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const image = event.currentTarget.querySelector("img");
    const bounds = image?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    event.preventDefault();
    launch({ book, rect: { left: bounds.left, top: bounds.top, width: bounds.width }, coverWidth: bounds.width, startAngle: 0 });
  }}/>;
}
