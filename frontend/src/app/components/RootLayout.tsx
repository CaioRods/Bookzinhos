import { useThemeCatalog, DEFAULT_THEMES } from "../lib/themeCatalog";
import { accentVariables } from "../lib/appearance";
import { SceneAtmosphere } from "./SceneAtmosphere";
import { Scenery } from "./Scenery";
import { GlobalSearch } from "./GlobalSearch";
import { Brand } from "./Brand";
import { Outlet, useLocation, useNavigation, Link, NavLink } from "react-router";
import {
  Home, Library, BookOpen, PenLine, User, Users, Shield, ChevronRight,
  SlidersHorizontal, LogIn,
} from "lucide-react";
import { useEffect, useState, useMemo, type ComponentType } from "react";
import { fetchNotifications } from "../lib/api";
import { getAvatar, getUsername, isAdmin as isAdminUser, isGuest, leaveGuestMode } from "../lib/session";
import { ReaderChoiceProvider } from "../lib/readerChoice";
import { BookTransitionProvider } from "./BookTransition";
import { NotificationsMenu } from "./NotificationsMenu";
import { AuthGateModal } from "./AuthGateModal";
import { RouteSkeleton } from "./Skeletons";
import { useSettings } from "../lib/settings";
import { primeSounds, soundTap } from "../lib/sounds";

interface NavItem {
  path: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  end?: boolean;
}

/**
 * Casca do aplicativo.
 *
 * Desktop: barra lateral integrada à esquerda, conteúdo ao lado e as
 * ações da conta no canto superior direito.
 * Celular: navegação flutuante com acesso a Meus livros no centro.
 */
export function RootLayout() {
  const location = useLocation();
  useEffect(() => { if (!location.hash) { document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "instant" }); window.scrollTo({ top: 0, behavior: "instant" }); } }, [location.pathname]);
  const [settings] = useSettings();
  const { themes } = useThemeCatalog();
  const selectedTheme = themes.find(theme => theme.id === settings.scene) || DEFAULT_THEMES[0];
  useEffect(() => {
    const apply = () => { const root = document.documentElement; Object.entries(accentVariables(selectedTheme.mainColor, root.classList.contains("dark"))).forEach(([key, value]) => root.style.setProperty(key, value)); };
    apply(); const media = window.matchMedia("(prefers-color-scheme: dark)"); media.addEventListener("change", apply);
    return () => { media.removeEventListener("change", apply); Object.keys(accentVariables(selectedTheme.mainColor)).forEach(key => document.documentElement.style.removeProperty(key)); };
  }, [selectedTheme.mainColor, settings.theme]);
  // Enquanto o roteador busca o módulo da próxima tela, mostramos o esqueleto
  // dela — a página já entra com a forma certa em vez de piscar em branco.
  const navigation = useNavigation();
  const pending = navigation.state === "loading" ? navigation.location.pathname : null;
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatar, setAvatar] = useState(getAvatar);
  const [username, setUsername] = useState(getUsername);
  const [admin, setAdmin] = useState(isAdminUser);
  const [guest, setGuest] = useState(isGuest);

  useEffect(() => {
    primeSounds();
    const warmRoutes = () => {
      void Promise.allSettled([
        import("../pages/Library"),
        import("../pages/MyBooks"),
        import("../pages/Social"),
        import("../pages/BookDetails"),
        import("../pages/Profile"),
        import("../pages/Settings"),
      ]);
    };
    const idle = window.setTimeout(warmRoutes, 500);
    return () => window.clearTimeout(idle);
  }, []);

  useEffect(() => {
    const syncSession = () => {
      setAvatar(getAvatar());
      setUsername(getUsername());
      setAdmin(isAdminUser());
      setGuest(isGuest());
    };
    syncSession();
    window.addEventListener("mybooks:session", syncSession);
    return () => window.removeEventListener("mybooks:session", syncSession);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await fetchNotifications();
        if (!cancelled) setUnreadCount(data.unreadCount);
      } catch {
        /* silencioso: o contador é secundário */
      }
    };
    check();
    const interval = window.setInterval(check, 8000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { path: "/", icon: Home, label: "Descobrir", end: true },
      { path: "/library", icon: Library, label: "Biblioteca" },
      { path: "/social", icon: Users, label: "Comunidade", badge: unreadCount },
      { path: "/my-books", icon: BookOpen, label: "Meus livros" },
      { path: "/notes", icon: PenLine, label: "Diário de leitura" },
    ];
    if (admin) items.push({ path: "/admin", icon: Shield, label: "Admin" });
    items.push({ path: "/settings", icon: SlidersHorizontal, label: "Configurações" });
    return items;
  }, [unreadCount, admin]);

  const isChat = location.pathname.startsWith("/chat/");
  const isRead = location.pathname.startsWith("/read/");
  const hideNav = new URLSearchParams(location.search).get("hideNav") === "true" || isChat || isRead;

  // Leitor e chat ocupam a tela inteira: a altura fixa aqui é o que permite que
  // eles usem `h-full` internamente para rolar só a área de conteúdo.
  if (hideNav) {
    return (
      <div className="h-screen overflow-hidden bg-background relative">
        <ReaderChoiceProvider>
          <div key={location.pathname} className="mb-page h-full">
            <Outlet />
          </div>
  {/* Enquanto o módulo da próxima tela desce, o esqueleto dela cobre a
              atual. Depois, com a rota já trocada, um segundo véu segura o
              esqueleto por um instante e dissolve sobre a página montada.
              Quem manda no tempo é a animação, não um cronômetro: assim a
              troca não depende de o componente sobreviver à navegação. */}
          {pending && (
            <div className="mb-veil" aria-hidden>
              <RouteSkeleton pathname={pending} />
            </div>
          )}
        </ReaderChoiceProvider>
      </div>
    );
  }

  return (
    <BookTransitionProvider>
      <AuthGateModal />
      <a href="#main-content" className="mb-skip-link">Pular para o conteúdo</a>
      <SceneAtmosphere theme={selectedTheme} />
      <div className="mb-app-window bg-background">
        {/* ── Barra lateral (desktop) ─────────────────────────────────────── */}
        <aside className="mb-sidebar hidden lg:flex flex-col overflow-hidden">
          <div className="mb-sidebar-art" style={{ opacity: selectedTheme.sidebarOpacity }}><Scenery scene={settings.scene} surface="sidebar" /></div>
          <Link to="/" className="flex items-center gap-3 px-6 h-[96px] flex-shrink-0">
            <Brand />
          </Link>


          <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar" aria-label="Navegação principal">
            {navItems.map(({ path, icon: Icon, label, badge, end }) => (
              <NavLink
                key={path}
                data-utility={path === "/admin" || path === "/settings" ? "true" : undefined}
                to={path}
                end={end}
                onClick={soundTap}
                className={({ isActive }) =>
                  `mb-nav-item flex items-center gap-3 px-3.5 h-11 rounded-[10px] text-[14px] transition-all ${
                    isActive
                      ? "text-[var(--primary)] font-semibold"
                      : "text-[var(--text-2)] font-medium hover:bg-[var(--surface-2)] hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-[19px] h-[19px] ${isActive ? "" : "opacity-80"}`} />
                    <span className="flex-1 truncate">{label}</span>
                    {!!badge && badge > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--primary)] text-white text-[11px] font-bold flex items-center justify-center">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {guest && (
          <div className="mb-sidebar-account p-3 space-y-3">
              <button
                onClick={() => leaveGuestMode()}
                className="mb-guest-card w-full rounded-[16px] bg-[var(--primary-soft)] border border-[var(--primary)]/25 p-3.5 text-left hover:bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] transition-colors cursor-pointer"
              >
                <span className="block text-[13.5px] font-bold text-[var(--primary)]">Você é visitante</span>
                <span className="block text-[12px] text-[var(--text-2)] mt-0.5 leading-snug">
                  Entre para ler, comentar e conversar.
                </span>
                <span className="mb-btn mb-btn-primary mb-btn-sm w-full mt-2.5 pointer-events-none">
                  <LogIn className="w-4 h-4" /> Entrar ou criar conta
                </span>
              </button>
          </div>
          )}
        </aside>

        {/* ── Ações da conta (desktop) ────────────────────────────────────── */}
        <div className="mb-desktop-actions hidden lg:flex items-center">
          <GlobalSearch />
          <NotificationsMenu />
          <Link to="/profile" aria-label="Meu perfil" className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-1)] flex items-center justify-center text-lg select-none hover:scale-105 transition-transform">
            {avatar}
          </Link>
        </div>

        {/* ── Cabeçalho (celular) ─────────────────────────────────────────── */}
        <header className="mb-mobile-header lg:hidden sticky top-0 z-40 h-16 px-5 flex items-center justify-between border-b border-[var(--line)]">
          <Link to="/" className="flex items-center gap-2">
            <Brand />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationsMenu />
            <NavLink
              to="/settings"
              aria-label="Configurações"
              className={({ isActive }) =>
                `w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? "text-[var(--primary)] bg-[var(--primary-soft)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                }`
              }
            >
              <SlidersHorizontal className="w-[18px] h-[18px]" />
            </NavLink>
            <Link to="/profile" aria-label="Meu perfil" className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-base select-none ml-0.5">
              {avatar}
            </Link>
          </div>
        </header>

        {/* ── Conteúdo ────────────────────────────────────────────────────── */}
        <main id="main-content" tabIndex={-1} className="mb-app-main">
          <ReaderChoiceProvider>
            {/* O invólucro posicionado é a caixa de conteúdo do `main`: sem ele
                o véu se estica por baixo da barra lateral, porque um elemento
                absoluto se mede pela caixa de padding do ancestral. */}
            <div className="relative">
            {/* A chave por rota reinicia a animação a cada navegação. */}
            <div key={location.pathname} className="mb-page">
              <Outlet />
            </div>

{/* Enquanto o módulo da próxima tela desce, o esqueleto dela cobre a
                atual. Depois, com a rota já trocada, um segundo véu segura o
                esqueleto por um instante e dissolve sobre a página montada.
                Quem manda no tempo é a animação, não um cronômetro: assim a
                troca não depende de o componente sobreviver à navegação. */}
            {pending && (
              <div className="mb-veil" aria-hidden>
                <RouteSkeleton pathname={pending} />
              </div>
            )}
            </div>
          </ReaderChoiceProvider>
        </main>

        {/* ── Barra inferior (celular) ────────────────────────────────────── */}
        <nav aria-label="Navegação principal" className="mb-mobile-dock lg:hidden fixed z-50">
          <div className="flex items-center h-[68px] px-1">
            <MobileTab to="/" end icon={Home} label="Descobrir" />
            <MobileTab to="/library" icon={Library} label="Biblioteca" />

            <MobileTab to="/my-books" icon={BookOpen} label="Meus livros" />

            <MobileTab to="/social" icon={Users} label="Social" badge={unreadCount} />
            <MobileTab to="/profile" icon={User} label="Perfil" />
          </div>
        </nav>
      </div>
    </BookTransitionProvider>
  );
}

function MobileTab({
  to, icon: Icon, label, end, badge,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={soundTap}
      aria-label={label}
      className={({ isActive }) =>
        `mb-tab flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors ${
          isActive ? "text-[var(--primary)]" : "text-[var(--text-3)]"
        }`
      }
    >
      <span className="relative">
        <Icon className="w-[21px] h-[21px]" />
        {!!badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--like)] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--surface)]">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </NavLink>
  );
}
