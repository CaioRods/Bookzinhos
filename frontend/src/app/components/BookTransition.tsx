import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Book3D } from "./Book3D";
import type { Book } from "../lib/types";

interface Flight {
  book: Book;
  /** Retângulo do livro na estante, no momento do clique */
  rect: { left: number; top: number; width: number };
  coverWidth: number;
  /** Ângulo em que o livro estava: 90° se guardado de lombada */
  startAngle: number;
}

type Launcher = (flight: Flight) => void;

interface FlightContext {
  launch: Launcher | null;
  /** Id do livro em voo — quem estiver na estante se esconde enquanto isso. */
  flyingId: string | null;
}

const BookFlightContext = createContext<FlightContext>({ launch: null, flyingId: null });

/** Abre um livro com a animação de voo; sem provedor, o chamador navega direto. */
export function useBookFlight(): Launcher | null {
  return useContext(BookFlightContext).launch;
}

/** O livro que está voando agora, para a estante não mostrar dois iguais. */
export function useFlyingBookId(): string | null {
  return useContext(BookFlightContext).flyingId;
}

const FLY_MS = 480;
const FADE_MS = 180;
const NAVIGATE_MS = 60;

/**
 * Animação de abertura de um livro.
 *
 * O livro clicado se solta da estante, atravessa a tela girando e cresce no
 * centro enquanto a página de detalhes carrega por baixo. Quem voa é uma cópia
 * em camada própria — a original se esconde no mesmo instante, então em tela
 * existe sempre um livro só. O provedor fica acima do roteador de propósito:
 * assim a animação sobrevive à navegação e não é cortada no meio.
 */
export function BookTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [fading, setFading] = useState(false);

  const launch = useCallback<Launcher>((next) => {
    setFading(false);
    setFlight(next);
  }, []);

  useEffect(() => {
    if (!flight) return;

    const toPage = window.setTimeout(() => {
      navigate(`/book/${flight.book.id}`);
      setFading(true);
    }, NAVIGATE_MS);
    const cleanup = window.setTimeout(() => setFlight(null), FLY_MS + FADE_MS);

    return () => {
      window.clearTimeout(toPage);
      window.clearTimeout(cleanup);
    };
  }, [flight, navigate]);

  // Quem prefere menos movimento vai direto para a página.
  const reducedMotion =
    typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true");

  const value = useMemo<FlightContext>(
    () => ({ launch: reducedMotion ? null : launch, flyingId: flight?.book.id ?? null }),
    [reducedMotion, launch, flight]
  );

  return (
    <BookFlightContext.Provider value={value}>
      {children}
      {flight && <FlyingBook flight={flight} fading={fading} />}
    </BookFlightContext.Provider>
  );
}

function FlyingBook({ flight, fading }: { flight: Flight; fading: boolean }) {
  const { book, rect, coverWidth, startAngle } = flight;

  const height = Math.round(coverWidth * 1.5);
  // O livro voa a partir do centro da vaga que ocupava na estante.
  const startLeft = rect.left + rect.width / 2 - coverWidth / 2;
  const startTop = rect.top;

  const targetHeight = Math.min(window.innerHeight * 0.62, 460);
  const scale = targetHeight / height;

  // A origem da transformação é o centro, então basta mover o centro.
  const dx = window.innerWidth / 2 - (startLeft + coverWidth / 2);
  const dy = window.innerHeight / 2 - (startTop + height / 2);

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        style={{ animation: "fade-in 0.45s ease both" }}
      />
      <div
        className="mb-flying"
        style={
          {
            left: startLeft,
            top: startTop,
            width: coverWidth,
            height,
            "--dx": `${dx}px`,
            "--dy": `${dy}px`,
            "--s": scale,
            "--a0": `${startAngle}deg`,
          } as React.CSSProperties
        }
      >
        <Book3D book={book} width={coverWidth} display="cover" still />
      </div>
    </div>,
    document.body
  );
}
