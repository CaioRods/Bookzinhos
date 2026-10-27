import { useEffect, useState, memo } from "react";
import { getFullUrl } from "../lib/types";
import { fallbackSpineColor, getSpineColor, type SpineColor } from "../lib/coverColor";
import type { Book, ReadingProgress } from "../lib/types";

/** A mesma curva de `--ease-flip`, escrita à mão: o atalho `transition` inline
 *  é descartado pelo navegador quando traz um `var()` dentro. */
export const EASE_OUT = "cubic-bezier(0.62, 0.03, 0.32, 1)";

export type BookDisplay = "cover" | "spine";

/**
 * Espessura do livro, em pixels.
 *
 * Livros mais longos ficam mais grossos — é o que faz uma estante de lombadas
 * parecer uma estante de verdade, em vez de uma fileira de tiras iguais.
 */
export function spineWidth(book: Book): number {
  const pages = book.pageCount || 0;
  if (pages > 0) return Math.round(Math.min(Math.max(42 + pages / 75, 44), 54));
  // Sem contagem de páginas, uma variação estável derivada do id.
  let hash = 0;
  for (let i = 0; i < book.id.length; i++) hash = (hash * 31 + book.id.charCodeAt(i)) % 1000;
  return 44 + (hash % 8);
}

/** Busca a cor dominante da capa, com reserva imediata enquanto carrega. */
export function useSpineColor(book: Book | null | undefined): SpineColor {
  const coverUrl = getFullUrl(book?.coverImagePath);
  const coverColor = book?.coverColor ?? null;
  const id = book?.id ?? "";
  const [color, setColor] = useState<SpineColor>(() => fallbackSpineColor(coverColor, id));

  useEffect(() => {
    let alive = true;
    setColor(fallbackSpineColor(coverColor, id));
    getSpineColor(coverUrl, coverColor, id).then((c) => {
      if (alive) setColor(c);
    });
    return () => { alive = false; };
  }, [coverUrl, coverColor, id]);

  return color;
}

interface Props {
  book: Book;
  /** Largura da capa em pixels. A altura sai daí, na proporção 2:3. */
  width: number;
  display?: BookDisplay;
  /** Posição na lista — escalona a animação da esquerda para a direita. */
  index?: number;
  progress?: ReadingProgress;
  /** Fita de destaque no canto (usada pelo ranking "Mais lidos") */
  rank?: number;
  /** Desliga o hover — usado pela cópia que voa na abertura do livro. */
  still?: boolean;
  /**
   * Pose fixa, em graus. Quando vem preenchida o livro ignora hover e o modo
   * estante e fica parado no ângulo pedido — é assim que o destaque da semana
   * mostra o volume de três quartos, com a lombada aparecendo.
   */
  pose?: { ry: number; rx?: number; rz?: number };
  /** Sombra projetada mais larga e difusa, para o livro parecer suspenso. */
  floating?: boolean;
}

/**
 * Um livro desenhado como objeto: capa, lombada e bloco de páginas em três
 * dimensões. Girar 90° em Y troca a capa pela lombada — é o "modo estante".
 *
 * Com o ponteiro em cima de uma lombada, o livro se desvira e sai um pouco da
 * estante, como quem puxa o volume para conferir a capa.
 */
function Book3DImpl({ book, width, display = "cover", index = 0, progress, rank, still, pose, floating }: Props) {
  const color = useSpineColor(book);
  const coverUrl = getFullUrl(book.coverImagePath);
  const [hovered, setHovered] = useState(false);

  const height = display === "spine" && !pose ? Math.max(220, Math.round(width * 1.5)) : Math.round(width * 1.5);
  const depth = spineWidth(book);
  const isSpine = display === "spine";

  const active = hovered && !still && !pose;
  // Só a lombada "desvira": na grade de capas o hover é apenas uma inclinação.
  const pulledOut = isSpine && active;
  const angle = pose ? pose.ry : isSpine && !pulledOut ? 90 : active ? -14 : 0;
  const slotWidth = pose || pulledOut ? width : isSpine ? depth : width;

  // A cascata só vale para a virada em massa; o hover responde na hora.
  const delay = active ? "0ms" : `${index * 45}ms`;
  const lift = active ? (isSpine ? -18 : -8) : 0;

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setHovered(true);
  };

  // A dedicated, readable spine avoids compressed 3D text and overlapping authors.
  if (isSpine && !pose) {
    return <div className="mb-book-scene mb-shelf-spine" style={{ width: depth, height, background: `linear-gradient(100deg, ${color.shade}, ${color.base} 18%, ${color.base} 75%, ${color.shade})`, color: color.ink }} title={`${book.title}${book.author ? ` — ${book.author}` : ""}`}>
      <span className="mb-spine-rule" />
      <span className="mb-spine-title"><span>{book.title}</span></span>
      <span className="mb-spine-number">{String(index + 1).padStart(2, "0")}</span>
      {!!progress && progress.progress > 0 && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/20"><span className="block h-full bg-current opacity-70" style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }} /></span>}
    </div>;
  }

  return (
    <div
      className="mb-book-scene relative select-none"
      onPointerEnter={onPointerEnter}
      onPointerLeave={() => setHovered(false)}
      style={{
        width: slotWidth,
        height,
        zIndex: active ? 30 : undefined,
      }}
    >
      <div
        className="mb-book-3d"
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width,
          height,
          marginLeft: -width / 2,
          transform: pose
            ? `rotateY(${pose.ry}deg) rotateX(${pose.rx ?? 0}deg) rotateZ(${pose.rz ?? 0}deg)`
            : `translateY(${lift}px) rotateY(${angle}deg)`,
          transitionDelay: delay,
        }}
      >
        {/* ── Capa ───────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[3px] rounded-r-[5px]"
          style={{
            transform: `translateZ(${depth / 2}px)`,
            backfaceVisibility: "hidden",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Capa de ${book.title}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            /* Sem imagem, desenhamos uma capa: duotom da paleta, filete no
               topo e o título tipografado — melhor do que um bloco vazio. */
            <div className="mb-generated-cover w-full h-full relative flex flex-col justify-between" style={{ background: `linear-gradient(150deg, ${color.base}, ${color.shade})` }}>
              <div className="absolute inset-0 opacity-25 mix-blend-overlay"
                   style={{ backgroundImage: "radial-gradient(120% 90% at 20% 0%, #fff, transparent 60%)" }} />
              <div className="relative px-2.5 pt-3">
                <span className="block w-7 h-[3px] rounded-full bg-white/70" />
              </div>
              <div className="relative px-2.5 pb-3">
                <p
                  className="text-white font-bold leading-[1.15] line-clamp-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  style={{ fontSize: Math.max(width * 0.093, 9) }}
                >
                  {book.title}
                </p>
                {book.author && (
                  <p
                    className="text-white/75 font-medium truncate mt-1"
                    style={{ fontSize: Math.max(width * 0.068, 8) }}
                  >
                    {book.author}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mb-book-binding" />
          <div className="mb-book-gloss" />

          {rank != null && (
            <span className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1.5 rounded-md bg-black/65 text-white text-[11px] font-bold flex items-center justify-center backdrop-blur-sm">
              {rank}
            </span>
          )}

          {!!progress && progress.progress > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/30">
              <div className="h-full bg-[var(--primary)]" style={{ width: `${progress.progress}%` }} />
            </div>
          )}
        </div>

        {/* ── Contracapa ─────────────────────────────────────────────────── */}
        {/* Sem `backface-visibility: hidden` esta face pinta por cima da capa:
            as duas ocupam o mesmo retângulo e só o lado voltado para a câmera
            deve aparecer. */}
        <div
          className="absolute inset-0 rounded-[3px]"
          style={{
            transform: `rotateY(180deg) translateZ(${depth / 2}px)`,
            backfaceVisibility: "hidden",
            background: `linear-gradient(160deg, ${color.base}, ${color.shade})`,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
          }}
        />

        {/* ── Lombada (face esquerda) ────────────────────────────────────── */}
        {/* Montada como uma edição impressa de verdade: cabeceado no topo,
            filetes duplos, título ao centro, autor no pé e um losango de
            editora — é o que separa uma lombada de uma tira colorida. */}
        <div
          className="absolute top-0 left-1/2 overflow-hidden rounded-l-[4px] rounded-r-[1px]"
          style={{
            width: depth,
            height,
            marginLeft: -depth / 2,
            transform: `rotateY(-90deg) translateZ(${width / 2}px)`,
            background: `linear-gradient(100deg, ${color.shade} 0%, ${color.base} 24%, ${color.tint} 48%, ${color.base} 72%, ${color.shade} 100%)`,
            color: color.ink,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.22)",
          }}
        >
          {/* Trama do papel/tecido da capa dura */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.14] mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 4px)",
            }}
          />

          {/* Cabeceado: a fitinha colorida no topo e na base do miolo */}
          <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: color.tint, opacity: 0.85 }} />
          <div className="absolute inset-x-0 bottom-0 h-[5px]" style={{ background: color.shade, opacity: 0.9 }} />

          {/* Filetes duplos, como gravação em folha */}
          {[10, 15].map((top) => (
            <div key={`t${top}`} className="absolute inset-x-[4px] rounded-full opacity-55"
                 style={{ top, height: top === 10 ? 2 : 1, background: color.ink }} />
          ))}
          {[10, 15].map((bottom) => (
            <div key={`b${bottom}`} className="absolute inset-x-[4px] rounded-full opacity-55"
                 style={{ bottom, height: bottom === 10 ? 2 : 1, background: color.ink }} />
          ))}

          {/* Título — ocupa o topo do miolo, com um limite claro em cima do
              autor para os dois nunca se sobreporem. O autor só entra quando a
              lombada é alta o bastante para caber sem espremer o título. */}
          {(() => {
            const hasAuthor = !!book.author && depth >= 24 && height >= 150;
            // Reserva do pé: espaço do autor (quando existe) + o losango.
            const footReserve = hasAuthor ? 96 : 34;
            return (
              <>
                <div
                  className="absolute inset-x-0 flex items-center justify-center px-[3px]"
                  style={{ top: 22, bottom: footReserve }}
                >
                  <span
                    className="font-bold leading-none tracking-[0.01em] overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      maxHeight: height - 22 - footReserve,
                      fontSize: Math.min(Math.max(depth * 0.34, 9), 13.5),
                      textShadow: "0 1px 1px rgba(0,0,0,0.3)",
                    }}
                    title={book.title}
                  >
                    {book.title}
                  </span>
                </div>

                {hasAuthor && (
                  <div
                    className="absolute inset-x-0 flex items-center justify-center px-[3px]"
                    style={{ bottom: 24, height: 62 }}
                  >
                    <span
                      className="font-medium leading-none opacity-70 overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        maxHeight: 56,
                        fontSize: Math.min(Math.max(depth * 0.26, 8), 10),
                        textShadow: "0 1px 1px rgba(0,0,0,0.28)",
                      }}
                      title={book.author}
                    >
                      {book.author}
                    </span>
                  </div>
                )}
              </>
            );
          })()}

          {/* Losango da "editora" */}
          <div
            className="absolute left-1/2 rotate-45 opacity-60"
            style={{ bottom: 13, width: 5, height: 5, marginLeft: -2.5, background: color.ink }}
          />

          {/* Volume: sombra nas quinas e um brilho na lateral esquerda */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(255,255,255,0.22) 28%, rgba(255,255,255,0.06) 52%, rgba(0,0,0,0.16) 78%, rgba(0,0,0,0.4) 100%)",
            }}
          />
        </div>

        {/* ── Bloco de páginas (face direita) ────────────────────────────── */}
        <div
          className="absolute top-0 left-1/2 rounded-r-[3px]"
          style={{
            width: depth,
            height,
            marginLeft: -depth / 2,
            transform: `rotateY(90deg) translateZ(${width / 2}px)`,
            background: "repeating-linear-gradient(90deg, #f6f1e8 0px, #f6f1e8 1px, #ddd4c4 1px, #ddd4c4 2px)",
            boxShadow: "inset 0 0 8px rgba(0,0,0,0.18)",
          }}
        />

        {/* ── Topo do bloco de páginas ───────────────────────────────────── */}
        <div
          className="absolute left-0 top-1/2"
          style={{
            width,
            height: depth,
            marginTop: -depth / 2,
            transform: `rotateX(90deg) translateZ(${height / 2}px)`,
            background: "repeating-linear-gradient(0deg, #f6f1e8 0px, #f6f1e8 1px, #e2d9ca 1px, #e2d9ca 2px)",
          }}
        />
      </div>

      {/* Sombra projetada no chão da estante */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-[50%] pointer-events-none"
        style={{
          bottom: floating ? -22 : -8,
          width: slotWidth * (floating ? 1.06 : 0.92),
          height: floating ? 22 : 10,
          background: `rgba(0,0,0,${floating ? 0.3 : active ? 0.16 : 0.28})`,
          filter: `blur(${floating ? 20 : active ? 9 : 6}px)`,
          transition: `width 0.8s ${EASE_OUT}, filter .3s ease, background-color .3s ease`,
          transitionDelay: delay,
        }}
      />
    </div>
  );
}

export const Book3D = memo(Book3DImpl);
