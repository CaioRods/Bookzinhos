import { communityApi, type Series } from "../lib/community";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router";
import {
  Image as ImageIcon, Megaphone, BookOpen, Users, LayoutDashboard, Plus, Trash2,
  Pencil, Eye, EyeOff, Pin, Loader2, Search, BarChart3, MousePointerClick, CalendarClock,
} from "lucide-react";
import {
  createBanner, createPost, deleteBanner, deleteBook, deletePost, fetchAdminOverview,
  fetchAllUsers, fetchBannerReport, fetchBanners, fetchBooks, fetchPosts, fetchProgression,
  adjustUserXp, fetchBadgeDefinitions, grantUserBadge, revokeUserBadge, setUserLevel, updateBanner, updatePost,
} from "../lib/api";
import { isAdmin as isAdminUser } from "../lib/session";
import { getFullUrl, timeAgo } from "../lib/types";
import type { AdminOverview, Banner, BannerReport, Book, HomePost, UserProfile } from "../lib/types";
import { Avatar, ConfirmDialog, EmptyState, Modal, PageHeader, SectionHeader, Skeleton, toast } from "../components/Ui";
import { EditBookModal } from "../components/EditBookModal";
import { CharacterAdmin } from "../components/CharacterAdmin";
import { ThemeReviewQueue } from "../components/ThemeReviewQueue";

type Tab = "overview" | "banners" | "posts" | "books" | "characters" | "themes" | "users";

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Visão geral", icon: LayoutDashboard },
  { key: "banners", label: "Banners", icon: ImageIcon },
  { key: "posts", label: "Postagens", icon: Megaphone },
  { key: "books", label: "Livros", icon: BookOpen },
  { key: "characters", label: "Personagens", icon: ImageIcon },
  { key: "themes", label: "Temas", icon: ImageIcon },
  { key: "users", label: "Leitores", icon: Users },
];

/**
 * Painel da conta Admin (emote 🐶).
 *
 * Tudo que é editado aqui vai direto para o servidor, então aparece para todos
 * os leitores na próxima vez que a home ou a biblioteca carregar.
 */
export function Admin() {
  const [tab, setTab] = useState<Tab>("overview");

  if (!isAdminUser()) return <Navigate to="/" replace />;

  return (
    <div className="mb-screen mb-screen--wide mb-admin">
      <div className="mb-6">
        <span className="mb-chip mb-chip-primary mb-3">🐶 Conta administradora</span>
        <PageHeader
          title="Painel do"
          highlight="myBooks"
          subtitle="Banners, mural e acervo — o que você mudar aqui vale para toda a comunidade."
          icon={<LayoutDashboard className="w-5 h-5" />}
          gradient="linear-gradient(140deg,#e0a33c,#c07f1f)"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-6 border-b border-[var(--line)] pb-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`mb-btn mb-btn-sm ${tab === key ? "mb-btn-soft" : "mb-btn-ghost"}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onNavigate={setTab} />}
      {tab === "banners" && <BannersTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "books" && <BooksTab />}
      {tab === "characters" && <CharacterAdmin />}
      {tab === "themes" && <ThemeReviewQueue />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

// ─── Visão geral ──────────────────────────────────────────────────────────────

function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  useEffect(() => {
    fetchAdminOverview().then(setOverview).catch(() => setOverview(null));
  }, []);

  const cards = [
    { label: "Livros no acervo", value: overview?.books, tab: "books" as Tab },
    { label: "Leitores cadastrados", value: overview?.users, tab: "users" as Tab },
    { label: "Avaliações publicadas", value: overview?.reviews, tab: null },
    { label: "Banners", value: overview?.banners, tab: "banners" as Tab },
    { label: "Postagens no mural", value: overview?.posts, tab: "posts" as Tab },
    { label: "Leituras registradas", value: overview?.readingSessions, tab: null },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-admin-stats grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => c.tab && onNavigate(c.tab)}
            disabled={!c.tab}
            className={`mb-card p-4 text-left ${c.tab ? "mb-card-hover cursor-pointer" : "cursor-default"}`}
          >
            {c.value == null ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
            )}
            <div className="text-[12px] text-[var(--text-3)] mt-1">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="mb-card p-5">
        <h3 className="text-[15px] font-bold text-foreground">Como funciona</h3>
        <ul className="mt-3 space-y-2 text-[13px] text-[var(--text-2)] leading-relaxed list-disc pl-5">
          <li><strong>Banners</strong> aparecem no topo da home. Envie a imagem que você montou; título e subtítulo são opcionais.</li>
          <li><strong>Postagens</strong> formam o mural da home — bom para avisos, indicações e desafios de leitura.</li>
          <li><strong>Livros</strong> podem ser editados ou removidos daqui; a remoção apaga também resenhas e progresso.</li>
          <li>Os rankings <strong>Mais lidos</strong> e <strong>Melhores avaliados</strong> se atualizam sozinhos conforme a comunidade lê e avalia.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Seletor de imagem reaproveitável ─────────────────────────────────────────

function ImagePicker({
  preview,
  onPick,
  aspect = "aspect-[3/1]",
  label = "Escolher imagem",
}: {
  preview: string | null;
  onPick: (file: File) => void;
  aspect?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full ${aspect} rounded-xl overflow-hidden border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--primary)]/40 transition-colors relative cursor-pointer`}
      >
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[var(--text-3)]">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[12.5px] font-semibold">{label}</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </>
  );
}

// ─── Banners ──────────────────────────────────────────────────────────────────

function BannersTab() {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [reporting, setReporting] = useState<Banner | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = () => fetchBanners(true, true).then(setBanners).catch(() => setBanners([]));
  useEffect(() => {
    load();
    fetchBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    try {
      await deleteBanner(id);
      setBanners((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
      toast("Banner removido.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao remover.", "error");
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      const updated = await updateBanner(banner.id, { isActive: !banner.isActive });
      setBanners((prev) => (prev ? prev.map((b) => (b.id === banner.id ? updated : b)) : prev));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao atualizar.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Banners da home"
        subtitle="Aparecem no topo, em carrossel, para todos os leitores"
        action={
          <button onClick={() => setEditing("new")} className="mb-btn mb-btn-primary mb-btn-sm">
            <Plus className="w-4 h-4" /> Novo banner
          </button>
        }
      />

      {banners === null ? (
        <Skeleton className="w-full h-32 rounded-xl" />
      ) : banners.length === 0 ? (
        <EmptyState
          emoji="🖼️"
          title="Nenhum banner ainda"
          description="Monte a arte do jeito que quiser e envie aqui — ela vira o destaque da home."
          action={<button onClick={() => setEditing("new")} className="mb-btn mb-btn-primary">Criar o primeiro</button>}
        />
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div key={banner.id} className="mb-card p-3 flex gap-3 items-center">
              <div className="w-32 aspect-[3/1] rounded-lg overflow-hidden bg-[var(--surface-2)] flex-shrink-0">
                {banner.imageUrl ? (
                  <img src={getFullUrl(banner.imageUrl)!} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[var(--lavender)] to-[var(--peach)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground truncate">{banner.title || "(sem título)"}</p>
                <p className="text-[12px] text-[var(--text-3)] truncate">{banner.subtitle || "—"}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <span className={`mb-chip ${bannerNoAr(banner) ? "mb-chip-primary" : ""}`}>
                    {situacaoDoBanner(banner)}
                  </span>
                  <span className="mb-chip">Ordem {banner.sortOrder}</span>
                  {banner.sponsor && <span className="mb-chip">Patrocínio: {banner.sponsor}</span>}
                  {(banner.startsAt > 0 || banner.endsAt > 0) && (
                    <span className="mb-chip">
                      <CalendarClock className="w-3 h-3" /> {periodoDoBanner(banner)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(banner)} aria-label="Ativar/ocultar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => setReporting(banner)} aria-label="Relatório" title="Relatório do patrocinador" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button onClick={() => setEditing(banner)} aria-label="Editar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmId(banner.id)} aria-label="Excluir" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BannerForm
          banner={editing === "new" ? null : editing}
          books={books}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {reporting && <BannerReportModal banner={reporting} onClose={() => setReporting(null)} />}

      <ConfirmDialog
        open={confirmId !== null}
        title="Excluir banner?"
        description="Ele some da home imediatamente."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

function BannerForm({
  banner, books, onClose, onSaved,
}: {
  banner: Banner | null;
  books: Book[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(banner?.title || "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle || "");
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl || "");
  const [bookId, setBookId] = useState(banner?.bookId || "");
  const [sortOrder, setSortOrder] = useState(banner?.sortOrder ?? 0);
  const [sponsor, setSponsor] = useState(banner?.sponsor || "");
  const [startsAt, setStartsAt] = useState(paraCampoData(banner?.startsAt));
  const [endsAt, setEndsAt] = useState(paraCampoData(banner?.endsAt));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(getFullUrl(banner?.imageUrl));
  const [isSaving, setIsSaving] = useState(false);

  const pick = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!file && !preview && !title.trim()) {
      return toast("Envie uma imagem ou escreva um título.", "error");
    }
    setIsSaving(true);
    try {
      if (banner) {
        await updateBanner(banner.id, { title, subtitle, linkUrl, bookId, sortOrder, sponsor, startsAt, endsAt }, file);
      } else {
        await createBanner({ title, subtitle, linkUrl, bookId, sortOrder, sponsor, startsAt, endsAt, imageFile: file });
      }
      toast(banner ? "Banner atualizado." : "Banner publicado na home!");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={banner ? "Editar banner" : "Novo banner"}
      description="Proporção recomendada: 3:1 (ex.: 1500 × 500 px)."
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={isSaving} className="mb-btn mb-btn-outline">Cancelar</button>
          <button onClick={save} disabled={isSaving} className="mb-btn mb-btn-primary">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {banner ? "Salvar" : "Publicar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ImagePicker preview={preview} onPick={pick} label="Enviar a arte do banner" />

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="banner-title" className="mb-label">Título (opcional)</label>
            <input id="banner-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mb-input" placeholder="Ex.: Clube de leitura de março" />
          </div>
          <div>
            <label htmlFor="banner-sub" className="mb-label">Subtítulo (opcional)</label>
            <input id="banner-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="mb-input" placeholder="Uma linha de apoio" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="banner-book" className="mb-label">Levar para um livro</label>
            <select id="banner-book" value={bookId} onChange={(e) => setBookId(e.target.value)} className="mb-input">
              <option value="">Nenhum</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="banner-link" className="mb-label">Ou um link / rota</label>
            <input id="banner-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="mb-input" placeholder="/library ou https://…" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="banner-sponsor" className="mb-label">Patrocinador</label>
            <input
              id="banner-sponsor"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              className="mb-input"
              placeholder="Ex.: Sebo da Praça"
            />
          </div>
          <div>
            <label htmlFor="banner-start" className="mb-label">Entra no ar</label>
            <input id="banner-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mb-input" />
          </div>
          <div>
            <label htmlFor="banner-end" className="mb-label">Sai do ar</label>
            <input id="banner-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mb-input" />
          </div>
        </div>

        <div className="w-32">
          <label htmlFor="banner-order" className="mb-label">Ordem</label>
          <input
            id="banner-order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="mb-input"
          />
        </div>

        <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed">
          Deixe as datas em branco para o banner ficar no ar sem prazo. Com data
          preenchida, ele entra e sai sozinho — você não precisa lembrar de
          desligar quando o contrato acabar.
        </p>
      </div>
    </Modal>
  );
}

// ─── Relatório do patrocinador ────────────────────────────────────────────────

/** Um banner só está no ar se está ativo e dentro do período contratado. */
function bannerNoAr(b: Banner, agora = Date.now()): boolean {
  if (!b.isActive) return false;
  if (b.startsAt && agora < b.startsAt) return false;
  if (b.endsAt && agora > b.endsAt) return false;
  return true;
}

function situacaoDoBanner(b: Banner): string {
  if (!b.isActive) return "Oculto";
  const agora = Date.now();
  if (b.startsAt && agora < b.startsAt) return "Agendado";
  if (b.endsAt && agora > b.endsAt) return "Encerrado";
  return "No ar";
}

const dia = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

function periodoDoBanner(b: Banner): string {
  if (b.startsAt && b.endsAt) return `${dia(b.startsAt)} – ${dia(b.endsAt)}`;
  if (b.startsAt) return `a partir de ${dia(b.startsAt)}`;
  return `até ${dia(b.endsAt)}`;
}

/** Instante em milissegundos para o `yyyy-mm-dd` que o `input[type=date]` usa. */
function paraCampoData(ms?: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * O relatório que o patrocinador recebe.
 *
 * Sem número medido ninguém renova contrato — por isso a tela mostra exibições,
 * cliques, taxa de clique e a série por dia, e deixa o texto pronto para copiar
 * e colar na mensagem para o cliente.
 */
function BannerReportModal({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  const [report, setReport] = useState<BannerReport | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetchBannerReport(banner.id)
      // O cliente devolve `null` em 404 em vez de lançar; sem esta guarda o
      // modal ficaria no esqueleto para sempre quando a rota não existe.
      .then((r) => (r ? setReport(r) : setErro("Relatório indisponível para este banner.")))
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, [banner.id]);

  const maiorDia = report ? Math.max(1, ...report.daily.map((d) => d.views)) : 1;

  const resumoParaCopiar = report
    ? [
        `Relatório — ${banner.title || "banner"}${banner.sponsor ? ` (${banner.sponsor})` : ""}`,
        `Período: ${dia(report.from)} a ${dia(report.to)}`,
        `Exibições: ${report.views.toLocaleString("pt-BR")}`,
        `Cliques: ${report.clicks.toLocaleString("pt-BR")}`,
        `Taxa de clique: ${report.ctr}%`,
      ].join("\n")
    : "";

  return (
    <Modal
      open
      onClose={onClose}
      title="Relatório do banner"
      description={banner.sponsor ? `Patrocínio de ${banner.sponsor}.` : "Banner da casa, sem patrocinador."}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="mb-btn mb-btn-outline">Fechar</button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(resumoParaCopiar).then(
                () => toast("Resumo copiado. Cole na mensagem para o patrocinador."),
                () => toast("Não deu para copiar.", "error")
              );
            }}
            disabled={!report}
            className="mb-btn mb-btn-primary"
          >
            Copiar resumo
          </button>
        </>
      }
    >
      {erro ? (
        <EmptyState emoji="😕" title="Erro ao carregar" description={erro} />
      ) : !report ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-[18px]" />
          <Skeleton className="h-40 w-full rounded-[18px]" />
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[12.5px] text-[var(--text-3)]">
            Período de {dia(report.from)} a {dia(report.to)}.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Metrica icon={<Eye className="w-4 h-4" />} label="Exibições" value={report.views.toLocaleString("pt-BR")} />
            <Metrica icon={<MousePointerClick className="w-4 h-4" />} label="Cliques" value={report.clicks.toLocaleString("pt-BR")} />
            <Metrica icon={<BarChart3 className="w-4 h-4" />} label="Taxa de clique" value={`${report.ctr}%`} />
          </div>

          {report.daily.length === 0 ? (
            <EmptyState emoji="📭" title="Nenhum registro ainda" description="Assim que o banner aparecer para alguém, os números começam a entrar aqui." />
          ) : (
            <div>
              <span className="mb-label">Por dia</span>
              <div className="flex items-end gap-1 h-32">
                {report.daily.map((d) => (
                  <div key={d.day} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0" title={`${d.day}: ${d.views} exibições, ${d.clicks} cliques`}>
                    {/* A coluna precisa de altura própria: uma barra em
                        porcentagem dentro de um pai auto colapsa para zero. */}
                    <div
                      className="w-full rounded-t bg-[var(--primary-soft)] flex flex-col justify-end"
                      style={{ height: `max(3px, ${(d.views / maiorDia) * 100}%)` }}
                    >
                      <div className="w-full rounded-t bg-[var(--primary)]" style={{ height: `${d.views > 0 ? (d.clicks / d.views) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[9px] text-[var(--text-3)] truncate w-full text-center">{d.day.slice(8)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-[var(--text-3)] mt-2">
                Barra clara: exibições. Parte escura: a fatia que virou clique.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Metrica({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[var(--surface-2)] p-4">
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        {icon} {label}
      </span>
      <p className="text-[22px] font-bold text-foreground mt-1.5">{value}</p>
    </div>
  );
}

// ─── Postagens ────────────────────────────────────────────────────────────────

function PostsTab() {
  const [posts, setPosts] = useState<HomePost[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [editing, setEditing] = useState<HomePost | "new" | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = () => fetchPosts(true, true).then(setPosts).catch(() => setPosts([]));
  useEffect(() => {
    load();
    fetchBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    try {
      await deletePost(id);
      setPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      toast("Postagem removida.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao remover.", "error");
    }
  };

  const patch = async (post: HomePost, data: Record<string, boolean>) => {
    try {
      const updated = await updatePost(post.id, data);
      setPosts((prev) => (prev ? prev.map((p) => (p.id === post.id ? updated : p)) : prev));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao atualizar.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Mural da home"
        subtitle="Avisos, indicações e desafios para a comunidade"
        action={
          <button onClick={() => setEditing("new")} className="mb-btn mb-btn-primary mb-btn-sm">
            <Plus className="w-4 h-4" /> Nova postagem
          </button>
        }
      />

      {posts === null ? (
        <Skeleton className="w-full h-24 rounded-xl" />
      ) : posts.length === 0 ? (
        <EmptyState
          emoji="📣"
          title="Mural vazio"
          description="Escreva o primeiro recado para os leitores."
          action={<button onClick={() => setEditing("new")} className="mb-btn mb-btn-primary">Escrever postagem</button>}
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="mb-card p-4">
              <div className="flex items-start gap-3">
                {post.imageUrl && (
                  <img src={getFullUrl(post.imageUrl)!} alt="" loading="lazy" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">{post.title || "(sem título)"}</p>
                  <p className="text-[13px] text-[var(--text-2)] line-clamp-2 mt-1 leading-relaxed">{post.content}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className={`mb-chip ${post.isActive ? "mb-chip-primary" : ""}`}>{post.isActive ? "Publicado" : "Oculto"}</span>
                    {post.isPinned && <span className="mb-chip"><Pin className="w-3 h-3" /> Fixado</span>}
                    <span className="mb-chip">❤️ {post.likes}</span>
                    <span className="mb-chip">{timeAgo(post.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => patch(post, { isPinned: !post.isPinned })} aria-label="Fixar" className={`mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm ${post.isPinned ? "text-[var(--primary)]" : ""}`}>
                    <Pin className="w-4 h-4" />
                  </button>
                  <button onClick={() => patch(post, { isActive: !post.isActive })} aria-label="Publicar/ocultar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                    {post.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditing(post)} aria-label="Editar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmId(post.id)} aria-label="Excluir" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PostForm
          post={editing === "new" ? null : editing}
          books={books}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Excluir postagem?"
        description="Ela some do mural para todos."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

function PostForm({
  post, books, onClose, onSaved,
}: {
  post: HomePost | null;
  books: Book[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [bookId, setBookId] = useState(post?.bookId || "");
  const [seriesId,setSeriesId]=useState(post?.seriesId || "");
  const [series,setSeries]=useState<Series[]>([]);
  useEffect(()=>{communityApi<Series[]>("/series").then(setSeries).catch(e=>toast(e.message,"error"))},[]);
  const [isPinned, setIsPinned] = useState(!!post?.isPinned);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(getFullUrl(post?.imageUrl));
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!title.trim() && !content.trim() && !file && !preview) {
      return toast("Escreva algo ou envie uma imagem.", "error");
    }
    setIsSaving(true);
    try {
      if (post) await updatePost(post.id, { title, content, bookId, seriesId, isPinned }, file);
      else await createPost({ title, content, bookId, seriesId, isPinned, imageFile: file });
      toast(post ? "Postagem atualizada." : "Postagem publicada no mural!");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={post ? "Editar postagem" : "Nova postagem"}
      description="Aparece no mural da home para todos os leitores."
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={isSaving} className="mb-btn mb-btn-outline">Cancelar</button>
          <button onClick={save} disabled={isSaving} className="mb-btn mb-btn-primary">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {post ? "Salvar" : "Publicar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="post-title" className="mb-label">Título</label>
          <input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mb-input" placeholder="Ex.: Leitura coletiva de abril" />
        </div>

        <div>
          <label htmlFor="post-content" className="mb-label">Texto</label>
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="mb-input resize-y leading-relaxed"
            placeholder="Escreva o recado para a comunidade…"
          />
        </div>

        <div>
          <span className="mb-label">Imagem (opcional)</span>
          <ImagePicker preview={preview} onPick={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} aspect="aspect-[16/7]" label="Enviar imagem da postagem" />
        </div>

        <label className="mb-label">Saga relacionada<select aria-label="Saga relacionada à postagem" className="mb-input mt-2" value={seriesId} onChange={e=>{setSeriesId(e.target.value);if(e.target.value)setBookId("")}}><option value="">Nenhuma saga</option>{series.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="grid sm:grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="post-book" className="mb-label">Livro relacionado</label>
            <select id="post-book" value={bookId} onChange={(e) => {setBookId(e.target.value);if(e.target.value)setSeriesId("")}} className="mb-input">
              <option value="">Nenhum</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setIsPinned((v) => !v)}
            className={`mb-btn ${isPinned ? "mb-btn-soft" : "mb-btn-outline"}`}
          >
            <Pin className="w-4 h-4" /> {isPinned ? "Fixado no topo" : "Fixar no topo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Livros ───────────────────────────────────────────────────────────────────

function BooksTab() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Book | null>(null);
  const [confirmBook, setConfirmBook] = useState<Book | null>(null);

  useEffect(() => {
    fetchBooks(true).then(setBooks).catch(() => setBooks([]));
  }, []);

  const filtered = useMemo(() => {
    if (!books) return [];
    const term = search.trim().toLowerCase();
    if (!term) return books;
    return books.filter((b) => b.title.toLowerCase().includes(term) || (b.author || "").toLowerCase().includes(term));
  }, [books, search]);

  const handleDelete = async (book: Book) => {
    setConfirmBook(null);
    try {
      await deleteBook(book.id);
      setBooks((prev) => (prev ? prev.filter((b) => b.id !== book.id) : prev));
      toast(`"${book.title}" foi removido.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao remover.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Acervo"
        subtitle={books ? `${books.length} livros cadastrados` : undefined}
        action={<Link to="/upload" className="mb-btn mb-btn-primary mb-btn-sm"><Plus className="w-4 h-4" /> Enviar livro</Link>}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no acervo…"
          className="mb-input pl-9"
        />
      </div>

      {books === null ? (
        <Skeleton className="w-full h-24 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="📚" title="Nenhum livro encontrado" />
      ) : (
        <div className="space-y-2">
          {filtered.map((book) => (
            <div key={book.id} className="mb-card p-3 flex items-center gap-3">
              <div className="w-10 aspect-[2/3] rounded overflow-hidden bg-[var(--surface-2)] flex-shrink-0">
                {book.coverImagePath && (
                  <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground truncate">{book.title}</p>
                <p className="text-[12px] text-[var(--text-3)] truncate">
                  {book.author || "Autor desconhecido"} · {book.genre}
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="mb-chip">⭐ {book.rating > 0 ? book.rating.toFixed(1) : "—"}</span>
                  <span className="mb-chip">{book.reviewCount} avaliações</span>
                  {!!book.readers && <span className="mb-chip">{book.readers} leitores</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Link to={`/book/${book.id}`} aria-label="Abrir" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  <Eye className="w-4 h-4" />
                </Link>
                <button onClick={() => setEditing(book)} aria-label="Editar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmBook(book)} aria-label="Excluir" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditBookModal
          book={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setBooks((prev) => (prev ? prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)) : prev));
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmBook !== null}
        title="Excluir livro?"
        description={confirmBook ? `“${confirmBook.title}” some para todos, junto com resenhas e progresso.` : undefined}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => confirmBook && handleDelete(confirmBook)}
        onCancel={() => setConfirmBook(null)}
      />
    </div>
  );
}

// ─── Leitores ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    fetchAllUsers(true).then(setUsers).catch(() => setUsers([]));
  }, []);

  return (
    <div className="space-y-4">
      <SectionHeader title="Leitores" subtitle={users ? `${users.length} contas na comunidade` : undefined} />

      {users === null ? (
        <Skeleton className="w-full h-24 rounded-xl" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {users.map((user) => (
            <article key={user.username} className="mb-card p-4">
              <Link to={`/user/${encodeURIComponent(user.username)}`} className="flex items-center gap-3 mb-card-hover rounded-xl">
                <Avatar emoji={user.avatar} size="md" />
                <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-foreground truncate">{user.username}</p>
                  {user.isAdmin && <span className="mb-chip mb-chip-primary">Admin</span>}
                </div>
                <p className="text-[12px] text-[var(--text-3)] truncate">{user.bio || "Sem bio"}</p>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="mb-chip">{user.followers ?? 0} seguidores</span>
                  <span className="mb-chip">{user.reviewCount ?? 0} resenhas</span>
                </div>
                </div>
              </Link>
              <UserProgressionAdmin username={user.username} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function UserProgressionAdmin({ username }: { username: string }) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchProgression>> | null>(null);
  const [amount, setAmount] = useState(100);
  const [level, setLevel] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [badgeDefinitions, setBadgeDefinitions] = useState<Awaited<ReturnType<typeof fetchBadgeDefinitions>>>([]);
  const [badgeCode, setBadgeCode] = useState("");

  useEffect(() => {
    Promise.all([fetchProgression(username, true), fetchBadgeDefinitions()]).then(([value, definitions]) => {
      setSummary(value); setLevel(value.level); setBadgeDefinitions(definitions); setBadgeCode((current) => current || definitions[0]?.code || "");
    }).catch(() => setSummary(null));
  }, [username]);

  const run = async (action: "xp" | "level") => {
    if (!reason.trim()) return toast("Informe o motivo do ajuste.", "error");
    setBusy(true);
    try {
      const value = action === "xp"
        ? await adjustUserXp(username, amount, reason)
        : await setUserLevel(username, level, reason);
      const refreshed = await fetchProgression(username, true);
      setSummary(refreshed);
      setLevel(refreshed.level);
      setReason("");
      toast(action === "xp" ? `${value.totalXp} XP no total.` : `Nível alterado para ${value.level}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível ajustar a progressão.", "error");
    } finally { setBusy(false); }
  };

  const selectedBadge = badgeDefinitions.find((badge) => badge.code === badgeCode);
  const earnedBadge = summary?.badges.find((badge) => badge.code === badgeCode);
  const updateBadge = async () => {
    if (!badgeCode) return;
    if (!reason.trim()) return toast("Informe o motivo da alteração do selo.", "error");
    setBusy(true);
    try {
      const badges = earnedBadge?.manual
        ? await revokeUserBadge(username, badgeCode, reason)
        : await grantUserBadge(username, badgeCode, reason);
      setSummary((current) => current ? { ...current, badges } : current);
      setReason("");
      toast(earnedBadge?.manual ? "Selo administrativo removido." : "Selo concedido ao leitor.");
    } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível alterar o selo.", "error"); }
    finally { setBusy(false); }
  };

  return <div className="mt-4 pt-3 border-t border-[var(--line)] space-y-2">
    <p className="text-[12px] text-[var(--text-3)]">{summary ? `Nível ${summary.level} · ${summary.totalXp} XP · ${summary.title}` : "Carregando progressão…"}</p>
    <input className="mb-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatório (fica na auditoria)" />
    <div className="grid grid-cols-2 gap-2">
      <div className="flex gap-1.5">
        <input className="mb-input min-w-0" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} aria-label={`XP para ${username}`} />
        <button className="mb-btn mb-btn-sm mb-btn-soft" disabled={busy} onClick={() => run("xp")}>Aplicar XP</button>
      </div>
      <div className="flex gap-1.5">
        <input className="mb-input min-w-0" type="number" min="1" max="100" value={level} onChange={(event) => setLevel(Number(event.target.value))} aria-label={`Nível de ${username}`} />
        <button className="mb-btn mb-btn-sm mb-btn-soft" disabled={busy} onClick={() => run("level")}>Definir nível</button>
      </div>
    </div>
    <div className="flex gap-1.5">
      <select className="mb-input min-w-0" value={badgeCode} onChange={(event) => setBadgeCode(event.target.value)} aria-label={`Selo para ${username}`}>
        {badgeDefinitions.map((badge) => <option key={badge.code} value={badge.code}>{badge.name}</option>)}
      </select>
      <button className="mb-btn mb-btn-sm mb-btn-outline" disabled={busy || !badgeCode || (!!earnedBadge && !earnedBadge.manual)} onClick={updateBadge}>
        {earnedBadge?.manual ? "Remover selo" : earnedBadge ? "Selo automático" : "Dar selo"}
      </button>
    </div>
    {selectedBadge && <p className="text-[11px] text-[var(--text-3)]">{selectedBadge.description}</p>}
  </div>;
}
