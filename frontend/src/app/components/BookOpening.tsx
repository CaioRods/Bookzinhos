import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";

function PaperLeaf({ index }: { index: number }) {
  return (
    <div
      className="mb-opening-leaf"
      style={{ "--leaf": index } as CSSProperties}
    >
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <path
          d="M47 26 Q61 12 77 11 L77 65 Q59 66 47 82Z"
          fill={index % 2 ? "#e8cdbb" : "#f7e8d6"}
        />
        <path
          d="M51 31 Q61 23 72 21 M51 38 Q61 30 72 28 M51 45 Q61 37 72 35 M51 52 Q61 44 72 42"
          fill="none"
          stroke="#b7917e"
          strokeWidth=".65"
          opacity=".23"
        />
      </svg>
    </div>
  );
}

/** Moving paper resolves into the unmodified master logo before the app is revealed. */
export function BookOpening({ onComplete }: { onComplete: () => void }) {
  const callback = useRef(onComplete);
  callback.current = onComplete;
  const finished = useRef(false);
  const skip = useRef<HTMLButtonElement>(null);
  const finish = () => {
    if (!finished.current) {
      finished.current = true;
      callback.current();
    }
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      skip.current?.focus({ preventScroll: true }),
    );
    // Safety net for blocked CSS, canceled animations or backgrounded tabs.
    const timeout = window.setTimeout(finish, 3600);
    const onVisibility = () => { if (document.hidden) finish(); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className="mb-opening"
      role="dialog"
      aria-modal="true"
      aria-label="Abertura do myBooks"
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === "mb-opening-screen"
        )
          finish();
      }}
    >
      <div
        className="mb-opening-halo mb-opening-halo--rose"
        aria-hidden="true"
      />
      <div
        className="mb-opening-halo mb-opening-halo--gold"
        aria-hidden="true"
      />
      <button ref={skip} className="mb-opening-skip" onClick={finish}>
        Pular abertura <span aria-hidden="true">→</span>
      </button>
      <div className="mb-opening-composition">
        <div className="mb-opening-perspective" aria-hidden="true">
          <div className="mb-opening-shadow" />
          <div className="mb-opening-sculpture">
            <svg className="mb-opening-tile" viewBox="0 0 96 96">
              <rect width="96" height="96" rx="24" fill="#faf7f2" />
            </svg>
            <div className="mb-opening-right">
              <svg viewBox="0 0 96 96">
                <path
                  d="M47 26 Q61 12 77 11 L77 65 Q59 66 47 82Z"
                  fill="#e9ccba"
                />
                <path
                  d="M77 20 Q86 16 85 24 L85 72 Q63 69 47 83 L47 35 Q57 27 77 20Z"
                  fill="#b76854"
                />
              </svg>
            </div>
            <div className="mb-opening-left">
              <svg viewBox="0 0 96 96">
                <path
                  d="M12 19 Q11 13 17 15 L36 24 Q43 28 46 37 L46 83 Q38 73 16 72 Q11 72 12 65Z"
                  fill="#57334f"
                />
                <path
                  d="M19 11 Q33 12 47 26 L47 82 Q36 65 19 64Z"
                  fill="#dec0ad"
                />
              </svg>
            </div>
            {[0, 1, 2, 3].map((index) => (
              <PaperLeaf key={index} index={index} />
            ))}
            <img
              className="mb-opening-final-logo"
              src="/logo.svg?v=3"
              alt=""
              width="168"
              height="168"
            />
          </div>
        </div>
        <div className="mb-opening-wordmark" aria-hidden="true">
          myBooks
        </div>
        <p className="mb-opening-caption">Mais histórias. Mais seu.</p>
        <span className="mb-opening-announcement" role="status">
          Abrindo seu universo de leitura…
        </span>
      </div>
    </div>,
    document.body,
  );
}
