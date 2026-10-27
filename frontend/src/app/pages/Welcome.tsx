import { useEffect } from "react";
import { Brand } from "../components/Brand";
export function Welcome({ userName, onComplete }: { userName: string; onComplete: () => void }) {
  useEffect(() => { const timer = setTimeout(onComplete, 1100); return () => clearTimeout(timer); }, [onComplete]);
  return <div className="mb-welcome min-h-screen bg-background flex items-center justify-center p-6"><div className="text-center mb-in"><Brand compact /><p className="mb-eyebrow mt-8">BOM TER VOCÊ POR AQUI</p><h1 className="mb-display mt-3">Olá, {userName}.</h1><p className="text-sm text-[var(--text-2)] mt-4">Sua próxima história está esperando.</p><button onClick={onComplete} className="mb-btn mb-btn-primary mt-7">Ir para minha biblioteca</button></div></div>;
}
