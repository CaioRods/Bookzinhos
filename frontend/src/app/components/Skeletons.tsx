import { Skeleton } from "./Ui";

/**
 * Esqueletos de tela.
 *
 * Cada um copia a estrutura real da página que substitui: mesma largura
 * máxima, mesmo respiro, mesma grade, mesmas alturas. É isso que faz o
 * conteúdo entrar sem pulo — o bloco cinza já ocupa exatamente o lugar e o
 * tamanho da informação que vai chegar ali.
 *
 * Quando mexer no layout de uma página, mexa no esqueleto dela também.
 */

/** Cabeçalho do `PageHeader`: bolha de 44px, título de 26px e a linha de apoio. */
function PageHeaderSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <header className="flex items-center gap-3.5">
      <Skeleton className="w-11 h-11 rounded-2xl flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-[26px] w-56 max-w-full rounded-lg" />
        {subtitle && <Skeleton className="h-[13px] w-72 max-w-full mt-2 rounded" />}
      </div>
    </header>
  );
}

/** Capa 2:3 com título e autor embaixo — a ficha usada em toda grade e trilho. */
function CoverSkeleton({ caption = true }: { caption?: boolean }) {
  return (
    <div>
      <Skeleton className="w-full aspect-[2/3] rounded-lg" />
      {caption && (
        <>
          <Skeleton className="h-3 w-4/5 mt-2.5 rounded" />
          <Skeleton className="h-3 w-3/5 mt-1.5 rounded" />
        </>
      )}
    </div>
  );
}

/** Cartão de lista com avatar, duas linhas e miniatura — feed e avaliações. */
function FeedCardSkeleton() {
  return (
    <div className="mb-card p-4 flex items-start gap-3">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-40 rounded" />
        <Skeleton className="h-3 w-24 mt-2 rounded" />
        <Skeleton className="h-3 w-full mt-3.5 rounded" />
        <Skeleton className="h-3 w-4/5 mt-1.5 rounded" />
      </div>
      <Skeleton className="w-12 aspect-[2/3] rounded-md flex-shrink-0" />
    </div>
  );
}

/** Título de seção com o "Ver tudo" à direita. */
function RowHeaderSkeleton({ width = "w-44" }: { width?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <Skeleton className={`h-[19px] ${width} rounded`} />
      <Skeleton className="h-3.5 w-16 rounded" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 sm:py-7">
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_330px] xl:gap-6 xl:items-start">
        <div className="min-w-0 space-y-8">
          {/* Saudação + busca */}
          <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="min-w-0">
              <Skeleton className="h-8 sm:h-[32px] w-72 max-w-full rounded-lg" />
              <Skeleton className="h-[14px] w-64 max-w-full mt-2.5 rounded" />
            </div>
            <Skeleton className="w-full md:w-[360px] h-12 rounded-[14px] flex-shrink-0" />
          </header>

          {/* Continue lendo */}
          <section>
            <RowHeaderSkeleton width="w-40" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[280px] rounded-[18px]" />)}
            </div>
          </section>

          {/* Recomendado para você */}
          <section>
            <RowHeaderSkeleton width="w-56" />
            <div className="flex gap-2 pb-1 mb-4 overflow-hidden">
              {[96, 112, 80, 88].map((w, i) => (
                <Skeleton key={i} className="h-9 rounded-full flex-shrink-0" style={{ width: w }} />
              ))}
            </div>
            <div className="flex gap-[1.125rem] pt-2 pb-5 overflow-hidden">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-[124px] flex-shrink-0">
                  <CoverSkeleton />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="hidden xl:flex flex-col gap-4 sticky top-6">
          <div className="mb-card p-4">
            <RowHeaderSkeleton width="w-36" />
            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-2/3 mt-1.5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-card p-4">
            <RowHeaderSkeleton width="w-40" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 mt-2 rounded" />
            <Skeleton className="h-11 w-full mt-4 rounded-[14px]" />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Biblioteca: grade de 6 colunas com barra de filtros em cima. */
export function LibrarySkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <PageHeaderSkeleton />
      <Skeleton className="h-12 w-full rounded-[14px]" />
      <div className="flex flex-wrap items-center gap-2">
        {[110, 92, 130, 84].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full" style={{ width: w }} />
        ))}
        <Skeleton className="h-4 w-32 ml-auto rounded" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-5 gap-y-8">
        {Array.from({ length: 18 }).map((_, i) => <CoverSkeleton key={i} />)}
      </div>
    </div>
  );
}

/** Favoritos: destaque da leitura em andamento e a estante guardada. */
export function MyBooksSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <RowHeaderSkeleton width="w-36" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-6">
        {Array.from({ length: 12 }).map((_, i) => <CoverSkeleton key={i} />)}
      </div>
    </div>
  );
}

/** Social: cabeçalho, feed e lista de leitores. */
export function SocialSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeaderSkeleton />
      <section className="space-y-4">
        <RowHeaderSkeleton width="w-32" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <FeedCardSkeleton key={i} />)}
        </div>
      </section>
      <section className="space-y-4">
        <RowHeaderSkeleton width="w-44" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-card p-4 flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-3 w-48 mt-2 rounded" />
              </div>
              <Skeleton className="h-8 w-24 rounded-[10px] flex-shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Diário de leitura: trilho de capas e a lista de anotações. */
export function NotesSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-[1.125rem] pt-2 pb-5 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[116px] flex-shrink-0">
            <CoverSkeleton />
          </div>
        ))}
      </div>
      <section className="mb-card p-5 space-y-4">
        <Skeleton className="h-[19px] w-48 rounded" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-36 rounded-xl ml-auto" />
      </section>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <FeedCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

/** Perfil (próprio ou de outra pessoa): capa, números e estante. */
export function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="mb-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <Skeleton className="h-3.5 w-28 mt-2 rounded" />
            <Skeleton className="h-3 w-full mt-3 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-[14px]" />)}
        </div>
      </div>
      <section>
        <RowHeaderSkeleton width="w-40" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-5">
          {Array.from({ length: 6 }).map((_, i) => <CoverSkeleton key={i} caption={false} />)}
        </div>
      </section>
      <div className="mb-card p-5 space-y-4">
        <Skeleton className="h-[19px] w-44 rounded" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Detalhe do livro: capa cinematográfica, abas e o trilho de fichas. */
export function BookDetailsSkeleton() {
  return (
    <div className="lg:px-2 lg:pb-6">
      <Skeleton className="w-full h-[420px] lg:rounded-[24px]" />
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-11/12 rounded" />
          <Skeleton className="h-3.5 w-9/12 rounded" />
          <div className="space-y-3 pt-2">
            {[0, 1].map((i) => <FeedCardSkeleton key={i} />)}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" />)}
          </div>
          <div className="mb-card p-5 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Leitor: barra de ferramentas e a página em branco no centro. */
export function ReaderSkeleton() {
  return (
    <div className="h-screen flex flex-col">
      <Skeleton className="h-14 w-full rounded-none" />
      <div className="flex-1 flex items-center justify-center p-6">
        <Skeleton className="w-full max-w-[620px] h-full rounded-[10px]" />
      </div>
    </div>
  );
}

/** Telas de formulário e listas simples — configurações, envio, admin, chat. */
export function ListSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeaderSkeleton />
      {[0, 1, 2].map((i) => (
        <section key={i} className="mb-card p-5 space-y-4">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-64 max-w-full rounded" />
          <Skeleton className="h-[68px] w-full rounded-[14px]" />
          <Skeleton className="h-[68px] w-full rounded-[14px]" />
        </section>
      ))}
    </div>
  );
}

/** Escolhe o esqueleto com a cara da rota que está sendo carregada. */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  if (pathname === "/") return <HomeSkeleton />;
  if (pathname.startsWith("/library")) return <LibrarySkeleton />;
  if (pathname.startsWith("/my-books")) return <MyBooksSkeleton />;
  if (pathname.startsWith("/social")) return <SocialSkeleton />;
  if (pathname.startsWith("/notes")) return <NotesSkeleton />;
  if (pathname.startsWith("/book/")) return <BookDetailsSkeleton />;
  if (pathname.startsWith("/read/")) return <ReaderSkeleton />;
  if (pathname.startsWith("/profile") || pathname.startsWith("/user/")) return <ProfileSkeleton />;
  return <ListSkeleton />;
}
