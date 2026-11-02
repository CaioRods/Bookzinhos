import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

/**
 * Carrega dados do servidor e os mantém frescos.
 *
 * Diferente do `setInterval` que o app usava antes, a revalidação só acontece
 * com a aba visível e há uma janela mínima entre chamadas — o que evita
 * requisições em segundo plano quando ninguém está olhando para a tela.
 */
export function useLiveData<T>(
  loader: (force: boolean) => Promise<T>,
  deps: unknown[] = [],
  options: { intervalMs?: number; focusThrottleMs?: number; enabled?: boolean } = {}
) {
  const { intervalMs = 30000, focusThrottleMs = 5000, enabled = true } = options;

  const [data, setStoredData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const mountedRef = useRef(true);
  const lastLoadRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const generationRef = useRef(0);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef<{ promise: Promise<void>; generation: number; version: number } | null>(null);

  // Uma mutação otimista invalida respostas de recargas iniciadas antes dela;
  // assim uma resposta atrasada nunca desfaz editar, excluir ou favoritar.
  const setData = useCallback<Dispatch<SetStateAction<T | null>>>((next) => {
    mutationVersionRef.current += 1;
    setStoredData(next);
  }, []);

  const load = useCallback(async (force = false) => {
    if (!enabled) return;
    const generation = generationRef.current;
    const versionAtStart = mutationVersionRef.current;
    const running = inFlightRef.current;
    if (running?.generation === generation && running.version === versionAtStart) return running.promise;
    lastLoadRef.current = Date.now();
    const requestId = ++requestIdRef.current;
    const isCurrent = () => mountedRef.current && generation === generationRef.current && requestId === requestIdRef.current;
    const promise = (async () => {
      try {
        const result = await loaderRef.current(force);
        if (!isCurrent()) return;
        if (versionAtStart !== mutationVersionRef.current) return;
        setStoredData(result);
        setError(null);
      } catch (err) {
        if (!isCurrent() || versionAtStart !== mutationVersionRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })().finally(() => {
      if (isCurrent()) {
        inFlightRef.current = null;
        setIsLoading(false);
      }
    });
    inFlightRef.current = { promise, generation, version: versionAtStart };
    return promise;
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    setStoredData(null);
    setError(null);
    setIsLoading(enabled);
    load(false);

    if (!enabled) return () => { mountedRef.current = false; };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      load(true);
    };

    const interval = window.setInterval(tick, intervalMs);

    // Ao voltar para a aba, revalida — mas só se já passou tempo suficiente.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadRef.current < focusThrottleMs) return;
      load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("mybooks:offline-data", tick);
    window.addEventListener("mybooks:synced", tick);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("mybooks:offline-data", tick);
      window.removeEventListener("mybooks:synced", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, focusThrottleMs, ...deps]);

  return { data, isLoading, error, reload: () => load(true), setData };
}
