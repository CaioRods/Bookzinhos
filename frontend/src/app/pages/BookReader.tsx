import { installedPdf, isOffline } from "../lib/offline/device";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Settings, ChevronLeft, ChevronRight, PenLine, PauseCircle, PlayCircle,
  CheckCircle, Maximize2, Minimize2, List, Download, Loader2, Sun, Plus, Minus,
  BookOpen, ScrollText, Columns2, Square, Bookmark, X,
} from "lucide-react";
import { fetchBook, fetchProgress, saveProgress, fetchChapters, saveChapter, deleteChapter, sendActivityHeartbeat } from "../lib/api";
import { createActivityTracker } from "../lib/activityTracker";
import { getFullUrl } from "../lib/types";
import type { Book, ReadingProgress, BookChapter } from "../lib/types";
import { useDeviceTier } from "../components/ui/use-device-tier";
import { downloadRemoteFile, safeFileName } from "../lib/download";
import { toast } from "../components/Ui";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// ─── Temas de leitura ─────────────────────────────────────────────────────────

type ThemeKey = "claro" | "creme" | "sepia" | "noite";

const THEMES: Record<ThemeKey, { label: string; bg: string; fg: string; muted: string; filter: string; swatch: string }> = {
  claro: { label: "Claro", bg: "#f5f4f2", fg: "#1c1917", muted: "rgba(28,25,23,.55)", filter: "none", swatch: "#ffffff" },
  creme: { label: "Creme", bg: "#f4eddf", fg: "#3f3327", muted: "rgba(63,51,39,.6)", filter: "sepia(.16) saturate(.96)", swatch: "#f4eddf" },
  sepia: { label: "Sépia", bg: "#2b2119", fg: "#e9dac3", muted: "rgba(233,218,195,.6)", filter: "sepia(.34) brightness(.9) contrast(1.02)", swatch: "#2b2119" },
  noite: { label: "Noite", bg: "#0b0b0e", fg: "#d7d3d0", muted: "rgba(215,211,208,.55)", filter: "invert(1) hue-rotate(180deg) brightness(.93) contrast(1.06)", swatch: "#0b0b0e" },
};

type Layout = "scroll" | "single" | "double";

const LAYOUTS: { key: Layout; label: string; icon: typeof ScrollText }[] = [
  { key: "scroll", label: "Rolagem", icon: ScrollText },
  { key: "single", label: "Página", icon: Square },
  { key: "double", label: "Livro", icon: Columns2 },
];

const PREFS_KEY = "mybooks-reader-prefs";

interface Prefs {
  layout: Layout;
  theme: ThemeKey;
  fitHeight: boolean;
  brightness: number;
  pageScale: number;
  fontSize: number;
  serif: boolean;
}

function loadPrefs(fallbackLayout: Layout): Prefs {
  const base: Prefs = {
    layout: fallbackLayout, theme: "creme", fitHeight: true,
    brightness: 1, pageScale: 1, fontSize: 19, serif: true,
  };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return base;
  }
}

// ─── Uma página do PDF desenhada num canvas ───────────────────────────────────

function PdfCanvas({
  doc, pageNumber, width, filter, className, style,
}: {
  doc: any;
  pageNumber: number;
  width: number;
  filter: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!doc || width <= 0) return;
    let task: any = null;
    let cancelled = false;
    setReady(false);

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      // 2× já cobre telas retina; acima disso o canvas fica pesado sem ganho visível.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || cancelled) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${width * (base.height / base.width)}px`;

      task = page.render({ canvasContext: ctx, viewport });
      await task.promise;
      if (!cancelled) setReady(true);
    })().catch((err) => {
      if (err?.name !== "RenderingCancelledException") console.error("Falha ao renderizar página", err);
    });

    return () => {
      cancelled = true;
      try { task?.cancel(); } catch { /* já finalizou */ }
    };
  }, [doc, pageNumber, width]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ ...style, filter, opacity: ready ? 1 : 0, transition: "opacity .25s ease" }}
    />
  );
}

// ─── Leitor ───────────────────────────────────────────────────────────────────

export function BookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tier = useDeviceTier();

  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<Prefs>(() =>
    loadPrefs(typeof window !== "undefined" && window.innerWidth < 900 ? "scroll" : "double")
  );
  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const theme = THEMES[prefs.theme];

  const [currentPage, setCurrentPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const [showUi, setShowUi] = useState(true);
  const [panel, setPanel] = useState<null | "settings" | "chapters">(null);
  const [jumpInput, setJumpInput] = useState("");

  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [chapterDraft, setChapterDraft] = useState<{ title: string; editing: boolean } | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfTotal, setPdfTotal] = useState(1);
  const [pageAspect, setPageAspect] = useState(1.414);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const uiTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const savedPageRef = useRef(-1);
  const activityPageRef = useRef(1);
  const restoredRef = useRef(false);

  useEffect(() => { activityPageRef.current = currentPage + 1; }, [currentPage]);
  useEffect(() => {
    if (!id) return;
    const tracker = createActivityTracker({ send: async (clientElapsedSeconds) => { try { await sendActivityHeartbeat({ scope: "reader", bookId: id, page: activityPageRef.current, clientElapsedSeconds }); } catch { /* leitura continua offline */ } } });
    const interact = () => tracker.interact();
    tracker.start();
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((event) => window.addEventListener(event, interact, { passive: true }));
    return () => { tracker.stop(); ["pointerdown", "keydown", "scroll", "touchstart"].forEach((event) => window.removeEventListener(event, interact)); };
  }, [id]);

  const pdfUrl = book?.pdfPath ? getFullUrl(book.pdfPath) : null;
  const textPages = book?.pages ?? [];
  const total = pdfUrl ? pdfTotal : Math.max(textPages.length, 1);
  const fullscreenSupported = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

  // ── Carregamento ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    Promise.all([fetchBook(id), fetchProgress(id).catch(() => null)])
      .then(([b, p]) => {
        setBook(b);
        if (p) {
          setCurrentPage(Math.max(0, p.currentPage));
          setIsPaused(p.status === "pausado");
          setIsFinished(p.status === "finalizado");
        }
      })
      .catch((err) => {
        console.error("Falha ao abrir o livro", err);
        setErrorMessage("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
      })
      // Sem isto, qualquer erro de rede deixaria a tela girando para sempre.
      .finally(() => setIsLoading(false));
  }, [id]);

  const loadChapters = useCallback(() => {
    if (!id) return;
    fetchChapters(id).then((data) => setChapters(data || [])).catch(() => setChapters([]));
  }, [id]);

  useEffect(() => { loadChapters(); }, [loadChapters]);

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

        let doc;
        const savedPdf = id ? await installedPdf(id).catch(() => undefined) : undefined;
        if (savedPdf) {
          doc = await pdfjs.getDocument({ data: await savedPdf.arrayBuffer() }).promise;
        } else if (pdfUrl.startsWith("blob:") || pdfUrl.startsWith("data:")) {
          const buffer = await (await fetch(pdfUrl)).arrayBuffer();
          doc = await pdfjs.getDocument({ data: buffer }).promise;
        } else {
          doc = await pdfjs.getDocument(pdfUrl).promise;
        }
        if (cancelled) return;

        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setPageAspect(vp.height / vp.width);
        setPdfDoc(doc);
        setPdfTotal(doc.numPages);
      } catch (err) {
        console.error("Falha ao carregar o PDF", err);
        if (!cancelled) setErrorMessage("Não foi possível abrir este PDF. O arquivo pode estar indisponível.");
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ── Medidas da área de leitura ────────────────────────────────────────────
  // O palco só existe depois que o livro carrega. Um `useEffect` de montagem
  // encontraria a ref vazia e desistiria — a largura ficaria em zero e o leitor
  // não sairia de "Preparando as páginas…". Com ref de callback, o observador
  // se liga no instante em que o elemento entra na árvore.
  useEffect(() => {
    if (!stageEl) return;

    const measure = (w: number, h: number) => setViewport({ w, h });
    const rect = stageEl.getBoundingClientRect();
    measure(rect.width, rect.height);

    const observer = new ResizeObserver(([entry]) => {
      measure(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  }, [stageEl]);

  useEffect(() => {
    const onChange = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── Progresso ─────────────────────────────────────────────────────────────
  const persistProgress = useCallback(
    async (pageNum: number, forceStatus?: ReadingProgress["status"]) => {
      if (!id) return;
      const pct = ((pageNum + 1) / total) * 100;
      const status = forceStatus || (pct >= 100 ? "finalizado" : isPaused ? "pausado" : "lendo");
      savedPageRef.current = pageNum;
      await saveProgress({
        bookId: id,
        currentPage: pageNum,
        totalPages: total,
        progress: Math.min(Math.round(pct), 100),
        status,
        startedAt: Date.now(),
        lastReadAt: Date.now(),
      });
      setIsFinished(status === "finalizado");
    },
    [id, total, isPaused]
  );

  // Grava a posição com folga: rolar não deve disparar uma escrita por página.
  useEffect(() => {
    if (isLoading || total <= 0 || savedPageRef.current === currentPage) return;
    if (isOffline()) { void persistProgress(currentPage).catch(() => toast("Não foi possível salvar o progresso neste aparelho.", "error")); return; }
    const t = setTimeout(() => { void persistProgress(currentPage).catch(() => toast("Não foi possível salvar o progresso.", "error")); }, 900);
    return () => clearTimeout(t);
  }, [currentPage, isLoading, persistProgress]);

  // ── Dimensões da página renderizada ───────────────────────────────────────
  const GAP = 18;
  const pageWidth = useMemo(() => {
    if (viewport.w <= 0) return 0;
    const padding = prefs.layout === "scroll" ? 24 : 40;
    const availW = Math.max(viewport.w - padding, 120);
    const availH = Math.max(viewport.h - padding, 200);

    if (prefs.layout === "double") {
      const byWidth = (availW - GAP) / 2;
      const byHeight = availH / pageAspect;
      return Math.floor(prefs.fitHeight ? Math.min(byWidth, byHeight) : byWidth) * prefs.pageScale;
    }
    if (prefs.layout === "single") {
      const byHeight = availH / pageAspect;
      return Math.floor(prefs.fitHeight ? Math.min(availW, byHeight) : availW) * prefs.pageScale;
    }
    return Math.floor(Math.min(availW, 920)) * prefs.pageScale;
  }, [viewport, pageAspect, prefs.layout, prefs.fitHeight, prefs.pageScale]);

  const pageHeight = pageWidth * pageAspect;
  const rowHeight = pageHeight + GAP;

  // ── Rolagem contínua (virtualizada) ───────────────────────────────────────
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || rowHeight <= 0) return;
    setScrollTop(el.scrollTop);
    const page = Math.min(total - 1, Math.max(0, Math.round(el.scrollTop / rowHeight)));
    setCurrentPage(page);
  }, [rowHeight, total]);

  // Ao abrir (ou trocar de modo), leva a rolagem até a página salva.
  useEffect(() => {
    if (prefs.layout !== "scroll" || rowHeight <= 0) return;
    const el = scrollRef.current;
    if (!el) return;
    if (restoredRef.current) return;
    restoredRef.current = true;
    el.scrollTop = currentPage * rowHeight;
  }, [prefs.layout, rowHeight, currentPage]);

  const goToPage = useCallback(
    (page: number) => {
      const target = Math.min(Math.max(page, 0), total - 1);
      setCurrentPage(target);
      if (prefs.layout === "scroll" && scrollRef.current && rowHeight > 0) {
        scrollRef.current.scrollTo({ top: target * rowHeight, behavior: "smooth" });
      }
    },
    [total, prefs.layout, rowHeight]
  );

  const step = prefs.layout === "double" ? 2 : 1;
  const goNext = useCallback(() => goToPage(currentPage + step), [goToPage, currentPage, step]);
  const goPrev = useCallback(() => goToPage(currentPage - step), [goToPage, currentPage, step]);

  // ── Interface que se esconde sozinha ──────────────────────────────────────
  const wakeUi = useCallback((keepOpen = false) => {
    setShowUi(true);
    clearTimeout(uiTimerRef.current);
    if (!keepOpen) uiTimerRef.current = setTimeout(() => setShowUi(false), 3800);
  }, []);

  useEffect(() => {
    wakeUi();
    return () => clearTimeout(uiTimerRef.current);
  }, [wakeUi]);

  useEffect(() => {
    if (panel) {
      clearTimeout(uiTimerRef.current);
      setShowUi(true);
    }
  }, [panel]);

  // ── Teclado ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowRight": case "PageDown": e.preventDefault(); goNext(); wakeUi(); break;
        case "ArrowLeft": case "PageUp": e.preventDefault(); goPrev(); wakeUi(); break;
        case " ": e.preventDefault(); e.shiftKey ? goPrev() : goNext(); wakeUi(); break;
        case "Home": e.preventDefault(); goToPage(0); break;
        case "End": e.preventDefault(); goToPage(total - 1); break;
        case "+": case "=": setPref("pageScale", Math.min(prefs.pageScale + 0.1, 2.5)); break;
        case "-": setPref("pageScale", Math.max(prefs.pageScale - 0.1, 0.5)); break;
        case "Escape": setPanel(null); break;
        case "t": case "T": {
          const keys = Object.keys(THEMES) as ThemeKey[];
          setPref("theme", keys[(keys.indexOf(prefs.theme) + 1) % keys.length]);
          break;
        }
        case "f": case "F": toggleFullscreen(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goNext, goPrev, goToPage, total, prefs.pageScale, prefs.theme]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await rootRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      toast("Tela cheia não disponível aqui.", "error");
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadRemoteFile(pdfUrl, safeFileName(book?.title || "livro", "pdf"));
    } catch {
      toast("Não foi possível baixar o PDF agora.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Toque: deslizar vira página, toque no meio mostra os controles ────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const dt = Date.now() - start.t;

    if (prefs.layout !== "scroll" && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 500) {
      dx < 0 ? goNext() : goPrev();
      wakeUi();
      return;
    }
    if (Math.hypot(dx, dy) < 12 && dt < 320) setShowUi((v) => !v);
  };

  const currentChapter = useMemo<{ chapter: BookChapter; number: number } | null>(() => {
    const sorted = [...chapters].sort((a, b) => a.startPage - b.startPage);
    let active: { chapter: BookChapter; number: number } | null = null;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].startPage > currentPage) break;
      active = { chapter: sorted[i], number: i + 1 };
    }
    return active;
  }, [chapters, currentPage]);

  const chapterHere = chapters.find((c) => c.startPage === currentPage);

  const saveChapterDraft = async () => {
    if (!id || !chapterDraft?.title.trim()) return;
    await saveChapter(id, currentPage, chapterDraft.title.trim());
    setChapterDraft(null);
    loadChapters();
    toast("Marcador salvo.");
  };

  const removeChapter = async (page: number) => {
    if (!id) return;
    await deleteChapter(id, page);
    loadChapters();
  };

  const toggleFinished = async () => {
    const next = isFinished ? "lendo" : "finalizado";
    await persistProgress(isFinished ? currentPage : total - 1, next);
    setIsFinished(!isFinished);
    if (!isFinished) goToPage(total - 1);
    toast(isFinished ? "Marcado como não lido." : "Livro concluído! 🎉");
  };

  const togglePaused = async () => {
    const next = !isPaused;
    setIsPaused(next);
    await persistProgress(currentPage, next ? "pausado" : "lendo");
    toast(next ? "Leitura pausada." : "Leitura retomada.");
  };

  // ── Estados de carregamento ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          <p className="text-[13px] text-[var(--text-3)]">Abrindo o livro…</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="h-full flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">📚</div>
          <h2 className="text-lg font-bold text-foreground">Livro não encontrado</h2>
          <button onClick={() => navigate(-1)} className="mb-btn mb-btn-primary">Voltar</button>
        </div>
      </div>
    );
  }

  const progressPct = ((currentPage + 1) / total) * 100;

  // ── Conteúdo ──────────────────────────────────────────────────────────────
  const renderStage = () => {
    if (errorMessage) {
      return (
        <div className="h-full flex items-center justify-center px-8">
          <div className="text-center space-y-4 max-w-sm">
            <div className="text-3xl">😕</div>
            <p className="text-[14px] font-semibold" style={{ color: theme.fg }}>{errorMessage}</p>
            <button onClick={() => navigate(-1)} className="mb-btn mb-btn-primary">Voltar</button>
          </div>
        </div>
      );
    }

    // ── PDF ──
    if (pdfUrl) {
      if (!pdfDoc || pageWidth <= 0) {
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-9 h-9 mx-auto rounded-full border-2 border-current border-t-transparent animate-spin opacity-40" style={{ color: theme.fg }} />
              <p className="text-[12.5px]" style={{ color: theme.muted }}>Preparando as páginas…</p>
            </div>
          </div>
        );
      }

      if (prefs.layout === "scroll") {
        // Só as páginas próximas da janela são desenhadas; o resto é altura vazia.
        const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
        const last = Math.min(total - 1, Math.ceil((scrollTop + viewport.h) / rowHeight) + 1);
        const slots = [];
        for (let i = first; i <= last; i++) slots.push(i);

        return (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full w-full overflow-auto no-scrollbar"
            style={{ scrollBehavior: "auto" }}
          >
            <div style={{ height: total * rowHeight, position: "relative", width: "100%" }}>
              {slots.map((i) => (
                <div
                  key={i}
                  className="absolute left-1/2 -translate-x-1/2 rounded-md overflow-hidden"
                  style={{
                    top: i * rowHeight,
                    width: pageWidth,
                    height: pageHeight,
                    background: prefs.theme === "noite" ? "#111" : "#fff",
                    boxShadow: "0 2px 10px rgba(0,0,0,.14), 0 14px 40px -18px rgba(0,0,0,.4)",
                  }}
                >
                  <PdfCanvas
                    doc={pdfDoc}
                    pageNumber={i + 1}
                    width={pageWidth}
                    filter={`${theme.filter} brightness(${prefs.brightness})`}
                    className="block"
                  />
                  <span
                    className="absolute bottom-1.5 right-2.5 text-[10px] font-semibold tabular-nums pointer-events-none"
                    style={{ color: theme.muted }}
                  >
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      const showRight = prefs.layout === "double" && currentPage + 1 < total;
      return (
        <div className="h-full w-full flex items-center justify-center overflow-auto no-scrollbar p-4">
          <div className="flex items-start" style={{ gap: GAP }}>
            <div
              key={`L${currentPage}`}
              className="rounded-md overflow-hidden animate-fade-in"
              style={{
                width: pageWidth,
                height: pageHeight,
                background: prefs.theme === "noite" ? "#111" : "#fff",
                boxShadow: "0 2px 10px rgba(0,0,0,.16), 0 18px 46px -20px rgba(0,0,0,.5)",
              }}
            >
              <PdfCanvas
                doc={pdfDoc}
                pageNumber={currentPage + 1}
                width={pageWidth}
                filter={`${theme.filter} brightness(${prefs.brightness})`}
                className="block"
              />
            </div>
            {showRight && (
              <div
                key={`R${currentPage}`}
                className="rounded-md overflow-hidden animate-fade-in"
                style={{
                  width: pageWidth,
                  height: pageHeight,
                  background: prefs.theme === "noite" ? "#111" : "#fff",
                  boxShadow: "0 2px 10px rgba(0,0,0,.16), 0 18px 46px -20px rgba(0,0,0,.5)",
                }}
              >
                <PdfCanvas
                  doc={pdfDoc}
                  pageNumber={currentPage + 2}
                  width={pageWidth}
                  filter={`${theme.filter} brightness(${prefs.brightness})`}
                  className="block"
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── Livro em texto ──
    const textStyle: React.CSSProperties = {
      fontSize: prefs.fontSize,
      lineHeight: 1.72,
      fontFamily: prefs.serif ? "Georgia, 'Times New Roman', serif" : "var(--font-sans)",
      color: theme.fg,
      maxWidth: "38rem",
      hyphens: "auto",
    };

    if (prefs.layout === "scroll") {
      return (
        <div ref={scrollRef} className="h-full w-full overflow-auto no-scrollbar px-5 py-16">
          <div className="mx-auto space-y-10" style={textStyle}>
            {textPages.map((text, i) => (
              <p key={i} className="whitespace-pre-wrap">{text}</p>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-auto no-scrollbar px-5 py-14 flex items-start justify-center">
        <div className={`w-full flex ${prefs.layout === "double" ? "gap-12" : ""}`} style={{ maxWidth: prefs.layout === "double" ? "60rem" : "38rem" }}>
          <p key={currentPage} className="flex-1 whitespace-pre-wrap animate-fade-in" style={textStyle}>
            {textPages[currentPage]}
          </p>
          {prefs.layout === "double" && currentPage + 1 < textPages.length && (
            <p key={currentPage + 1} className="flex-1 whitespace-pre-wrap animate-fade-in" style={textStyle}>
              {textPages[currentPage + 1]}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="mb-reader h-full w-full relative overflow-hidden select-none"
      style={{ background: theme.bg, color: theme.fg, transition: "background-color .4s ease, color .4s ease" }}
      onMouseMove={() => wakeUi()}
    >
      {/* ── Palco ─────────────────────────────────────────────────────────── */}
      <div
        ref={setStageEl}
        className="absolute inset-0"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          // No desktop, clicar no meio alterna os controles; nas laterais, vira a página.
          if (tier === "mobile") return;
          const x = e.clientX - (e.currentTarget.getBoundingClientRect().left || 0);
          const w = e.currentTarget.clientWidth;
          if (prefs.layout !== "scroll" && x < w * 0.22) goPrev();
          else if (prefs.layout !== "scroll" && x > w * 0.78) goNext();
          else setShowUi((v) => !v);
        }}
      >
        {renderStage()}
      </div>

      {/* Zonas de virada, visíveis só ao passar o mouse */}
      {prefs.layout !== "scroll" && tier === "desktop" && (
        <>
          <button
            onClick={goPrev}
            disabled={currentPage === 0}
            aria-label="Página anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full mb-glass flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity disabled:pointer-events-none"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            disabled={currentPage >= total - 1}
            aria-label="Próxima página"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full mb-glass flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity disabled:pointer-events-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* ── Ilha superior ─────────────────────────────────────────────────── */}
      <div
        className={`absolute top-0 inset-x-0 z-30 px-3 pt-3 transition-all duration-400 ${
          showUi ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0 pointer-events-none"
        }`}
      >
        <div className="mb-reader-toolbar mb-glass mx-auto max-w-3xl h-14 rounded-2xl flex items-center gap-1 px-2">
          <button onClick={() => navigate(-1)} aria-label="Voltar" className="mb-btn mb-btn-ghost mb-btn-icon flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 text-center px-1">
            <p className="text-[13.5px] font-semibold truncate">{book.title}</p>
            <p className="text-[11px] truncate" style={{ color: theme.muted }}>
              {currentChapter
                ? `Cap. ${currentChapter.number} · ${currentChapter.chapter.title}`
                : `${Math.round(progressPct)}% lido`}
            </p>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setChapterDraft({ title: chapterHere?.title || `Capítulo ${chapters.length + 1}`, editing: !!chapterHere })}
              aria-label="Marcar capítulo"
              className={`mb-btn mb-btn-ghost mb-btn-icon ${chapterHere ? "text-[var(--primary)]" : ""}`}
            >
              <Bookmark className={`w-[18px] h-[18px] ${chapterHere ? "fill-current" : ""}`} />
            </button>
            <button onClick={() => setPanel("chapters")} aria-label="Capítulos" className="mb-btn mb-btn-ghost mb-btn-icon">
              <List className="w-[18px] h-[18px]" />
            </button>
            {fullscreenSupported && (
              <button onClick={toggleFullscreen} aria-label="Tela cheia" className="mb-btn mb-btn-ghost mb-btn-icon hidden sm:inline-flex">
                {isNativeFullscreen ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
              </button>
            )}
            <button onClick={() => setPanel("settings")} aria-label="Ajustes de leitura" className="mb-btn mb-btn-ghost mb-btn-icon">
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Ilha inferior ─────────────────────────────────────────────────── */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all duration-400 ${
          showUi ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
        }`}
      >
        <div className="mb-glass mx-auto max-w-3xl rounded-2xl px-3 py-2.5 space-y-2.5">
          {/* Trilha de progresso com marcadores de capítulo */}
          <div className="relative px-1 pt-1.5">
            <input
              type="range"
              min={0}
              max={Math.max(total - 1, 0)}
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              aria-label="Posição no livro"
              className="w-full accent-[var(--primary)] cursor-pointer"
            />
            <div className="absolute inset-x-1 top-0 h-1.5 pointer-events-none">
              {chapters.map((ch) => (
                <span
                  key={ch.startPage}
                  className="absolute w-[3px] h-[7px] rounded-full bg-[var(--primary)] opacity-70"
                  style={{ left: `${(ch.startPage / Math.max(total - 1, 1)) * 100}%` }}
                  title={ch.title}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={goPrev} disabled={currentPage === 0} aria-label="Anterior" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
              <ChevronLeft className="w-4 h-4" />
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseInt(jumpInput, 10);
                if (!isNaN(n)) goToPage(n - 1);
                setJumpInput("");
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="number"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder={`${currentPage + 1}`}
                aria-label="Ir para a página"
                className="w-14 h-8 rounded-lg bg-black/5 dark:bg-white/10 text-center text-[12.5px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
              <span className="text-[12px] tabular-nums" style={{ color: theme.muted }}>de {total}</span>
            </form>

            <button onClick={goNext} disabled={currentPage >= total - 1} aria-label="Próxima" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            <button onClick={togglePaused} className="mb-btn mb-btn-sm mb-btn-ghost">
              {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              <span className="hidden sm:inline">{isPaused ? "Retomar" : "Pausar"}</span>
            </button>
            <button onClick={toggleFinished} className={`mb-btn mb-btn-sm ${isFinished ? "mb-btn-soft" : "mb-btn-ghost"}`}>
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{isFinished ? "Lido" : "Concluir"}</span>
            </button>
            <button onClick={() => navigate(`/notes?bookId=${id}`)} aria-label="Diário" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
              <PenLine className="w-4 h-4" />
            </button>
            {pdfUrl && (
              <button onClick={handleDownload} disabled={isDownloading} aria-label="Baixar PDF" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm hidden sm:inline-flex">
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fio de progresso sempre visível, mesmo com os controles ocultos */}
      <div className="absolute bottom-0 inset-x-0 h-[2px] bg-black/10 z-20 pointer-events-none">
        <div className="h-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Painel de ajustes ─────────────────────────────────────────────── */}
      {panel === "settings" && (
        <ReaderPanel title="Ajustes de leitura" onClose={() => setPanel(null)}>
          <div className="space-y-5">
            <div>
              <span className="mb-label">Modo de leitura</span>
              <div className="grid grid-cols-3 gap-2">
                {LAYOUTS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      restoredRef.current = false;
                      setPref("layout", key);
                    }}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all cursor-pointer ${
                      prefs.layout === key
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                        : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--primary)]/40"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11.5px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-label">Tema da página</span>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setPref("theme", key)}
                    className={`py-2.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      prefs.theme === key ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20" : "border-[var(--line)]"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full border border-black/10" style={{ background: THEMES[key].swatch }} />
                    <span className="text-[11px] font-semibold text-[var(--text-2)]">{THEMES[key].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {pdfUrl ? (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="mb-label mb-0">Tamanho da página</span>
                    <span className="text-[11.5px] font-semibold text-[var(--text-3)]">{Math.round(prefs.pageScale * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Minus className="w-4 h-4 text-[var(--text-3)]" />
                    <input
                      type="range" min={0.5} max={2.5} step={0.05}
                      value={prefs.pageScale}
                      onChange={(e) => setPref("pageScale", Number(e.target.value))}
                      className="flex-1 accent-[var(--primary)]"
                    />
                    <Plus className="w-4 h-4 text-[var(--text-3)]" />
                  </div>
                </div>

                {prefs.layout !== "scroll" && (
                  <div>
                    <span className="mb-label">Encaixe</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPref("fitHeight", true)}
                        className={`mb-btn ${prefs.fitHeight ? "mb-btn-primary" : "mb-btn-outline"}`}
                      >
                        Página inteira
                      </button>
                      <button
                        onClick={() => setPref("fitHeight", false)}
                        className={`mb-btn ${!prefs.fitHeight ? "mb-btn-primary" : "mb-btn-outline"}`}
                      >
                        Largura total
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="mb-label mb-0">Brilho da página</span>
                    <span className="text-[11.5px] font-semibold text-[var(--text-3)]">{Math.round(prefs.brightness * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Sun className="w-4 h-4 text-[var(--text-3)] opacity-50" />
                    <input
                      type="range" min={0.55} max={1.15} step={0.01}
                      value={prefs.brightness}
                      onChange={(e) => setPref("brightness", Number(e.target.value))}
                      className="flex-1 accent-[var(--primary)]"
                    />
                    <Sun className="w-5 h-5 text-[var(--text-3)]" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="mb-label mb-0">Tamanho da letra</span>
                    <span className="text-[11.5px] font-semibold text-[var(--text-3)]">{prefs.fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[12px] font-semibold text-[var(--text-3)]">A</span>
                    <input
                      type="range" min={14} max={30} step={1}
                      value={prefs.fontSize}
                      onChange={(e) => setPref("fontSize", Number(e.target.value))}
                      className="flex-1 accent-[var(--primary)]"
                    />
                    <span className="text-[19px] font-semibold text-[var(--text-3)]">A</span>
                  </div>
                </div>
                <div>
                  <span className="mb-label">Tipografia</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPref("serif", true)} className={`mb-btn ${prefs.serif ? "mb-btn-primary" : "mb-btn-outline"}`}>
                      <span style={{ fontFamily: "Georgia, serif" }}>Serifada</span>
                    </button>
                    <button onClick={() => setPref("serif", false)} className={`mb-btn ${!prefs.serif ? "mb-btn-primary" : "mb-btn-outline"}`}>
                      Sem serifa
                    </button>
                  </div>
                </div>
              </>
            )}

            <p className="text-[11.5px] leading-relaxed text-[var(--text-3)]">
              Atalhos: <strong>←/→</strong> vira a página · <strong>espaço</strong> avança ·
              <strong> T</strong> troca o tema · <strong>F</strong> tela cheia · <strong>+/−</strong> ajusta o tamanho.
            </p>
          </div>
        </ReaderPanel>
      )}

      {/* ── Painel de capítulos ───────────────────────────────────────────── */}
      {panel === "chapters" && (
        <ReaderPanel title="Capítulos e marcadores" onClose={() => setPanel(null)}>
          {chapters.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-7 h-7 mx-auto text-[var(--text-3)] mb-3" />
              <p className="text-[13px] text-[var(--text-3)]">Nenhum marcador ainda.</p>
              <button
                onClick={() => { setPanel(null); setChapterDraft({ title: "Capítulo 1", editing: false }); }}
                className="mb-btn mb-btn-primary mt-4"
              >
                <Bookmark className="w-4 h-4" /> Marcar esta página
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...chapters].sort((a, b) => a.startPage - b.startPage).map((ch, i) => (
                <div
                  key={ch.startPage}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                    currentPage === ch.startPage
                      ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                      : "border-[var(--line)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <button
                    onClick={() => { goToPage(ch.startPage); setPanel(null); }}
                    className="flex-1 text-left cursor-pointer min-w-0"
                  >
                    <p className="text-[13px] font-semibold text-foreground truncate">{i + 1}. {ch.title}</p>
                    <p className="text-[11.5px] text-[var(--text-3)]">Página {ch.startPage + 1}</p>
                  </button>
                  <button
                    onClick={() => removeChapter(ch.startPage)}
                    aria-label="Remover marcador"
                    className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ReaderPanel>
      )}

      {/* ── Marcar capítulo ───────────────────────────────────────────────── */}
      {chapterDraft && (
        <ReaderPanel
          title={chapterDraft.editing ? "Editar marcador" : "Marcar capítulo"}
          subtitle={`Página ${currentPage + 1}`}
          onClose={() => setChapterDraft(null)}
        >
          <div className="space-y-4">
            <input
              autoFocus
              value={chapterDraft.title}
              onChange={(e) => setChapterDraft({ ...chapterDraft, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && saveChapterDraft()}
              placeholder="Nome do capítulo"
              className="mb-input"
            />
            <div className="flex gap-2 justify-end">
              {chapterDraft.editing && (
                <button
                  onClick={() => { removeChapter(currentPage); setChapterDraft(null); }}
                  className="mb-btn mb-btn-ghost mr-auto"
                >
                  Remover
                </button>
              )}
              <button onClick={() => setChapterDraft(null)} className="mb-btn mb-btn-outline">Cancelar</button>
              <button onClick={saveChapterDraft} className="mb-btn mb-btn-primary">Salvar</button>
            </div>
          </div>
        </ReaderPanel>
      )}
    </div>
  );
}

// ─── Folha de vidro usada pelos painéis do leitor ─────────────────────────────

function ReaderPanel({
  title, subtitle, onClose, children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px] animate-fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md mb-glass-strong rounded-t-3xl sm:rounded-3xl p-5 sm:mb-6 max-h-[86%] overflow-y-auto animate-slide-up sm:animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-[12px] text-[var(--text-3)] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
