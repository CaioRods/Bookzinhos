import { Brand } from "./Brand";
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { Home, RotateCcw } from "lucide-react";

/**
 * Tela de erro do aplicativo.
 *
 * Um defeito numa tela não deve virar aquela página branca de rastreamento de
 * pilha: aqui a pessoa entende o que aconteceu, recarrega ou volta para a home.
 * O detalhe técnico continua disponível, mas dobrado.
 */
export function ErrorScreen() {
  const error = useRouteError();

  const title = isRouteErrorResponse(error)
    ? error.status === 404
      ? "Não encontramos esta página"
      : `Erro ${error.status}`
    : "Algo saiu do lugar";

  const detail =
    isRouteErrorResponse(error)
      ? error.statusText || ""
      : error instanceof Error
      ? `${error.message}\n\n${error.stack ?? ""}`
      : String(error ?? "");

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="mb-error-card mb-card p-8 max-w-lg w-full text-center">
        <Brand compact />

        <h1 className="mb-display text-[32px] text-foreground mt-6">{title}</h1>
        <p className="text-[14px] text-[var(--text-2)] leading-relaxed mt-2">
          A tela não conseguiu carregar. Recarregar costuma resolver — se voltar a
          acontecer, conte o que você estava fazendo.
        </p>

        <div className="flex items-center justify-center gap-2.5 mt-6">
          <button onClick={() => window.location.reload()} className="mb-btn mb-btn-primary">
            <RotateCcw className="w-4 h-4" /> Recarregar
          </button>
          <Link to="/" className="mb-btn mb-btn-outline">
            <Home className="w-4 h-4" /> Ir para o início
          </Link>
        </div>

        {detail && (
          <details className="text-left mt-6">
            <summary className="text-[12.5px] text-[var(--text-3)] cursor-pointer select-none">
              Detalhe técnico
            </summary>
            <pre className="text-[11px] text-[var(--text-3)] whitespace-pre-wrap break-words mt-2 max-h-52 overflow-auto">
              {detail}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
