import { installApp, useAppInstallation } from "../lib/installApp";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CloudOff, RefreshCw, Download, Wifi, X } from "lucide-react";
import { API_BASE_URL } from "../lib/config";
import { account, cancelOtherAccountInstalls, connectionLost, connectionRestored, DEVICE_EVENT, isOffline, pendingMutations, synchronize, syncState, useOffline } from "../lib/offline/device";
export function OfflineStatus() {
  const offline = useOffline(), location = useLocation(), navigate = useNavigate();
  const [pending, setPending] = useState(0), [, refresh] = useState(0);
  const { available, installed, busy } = useAppInstallation();
  const [help, setHelp] = useState(false);
  useEffect(() => {
    let active = true;
    const update = () => { cancelOtherAccountInstalls(); const user = account(); void pendingMutations(user).then(items => { if (active && account() === user) { setPending(items.length); refresh(value => value+1); } }).catch(() => {}); };
    const probe = async () => {
      if (!navigator.onLine) { connectionLost(); return; }
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
      try { const response = await fetch(API_BASE_URL + "/health", { cache: "no-store", signal: controller.signal }); if (!response.ok) return; connectionRestored(); if ((await pendingMutations()).length) void synchronize(); } catch { connectionLost(); } finally { clearTimeout(timeout); }
    };
    const offlineEvent = () => connectionLost();
    update(); void probe(); const timer = setInterval(() => { if (document.visibilityState === "visible") void probe(); }, 15000);
    window.addEventListener("online", probe); window.addEventListener("offline", offlineEvent); window.addEventListener(DEVICE_EVENT, update); window.addEventListener("mybooks:session", update);
    return () => { active = false; clearInterval(timer); window.removeEventListener("online", probe); window.removeEventListener("offline", offlineEvent); window.removeEventListener(DEVICE_EVENT, update); window.removeEventListener("mybooks:session", update); };
  }, []);
  useEffect(() => {
    if (offline && !/^\/(library|my-books|notes|book\/[^/]+|read\/[^/]+)\/?$/.test(location.pathname)) navigate("/library", { replace: true });
  }, [offline, location.pathname, navigate]);
  const status = syncState.user === account() ? syncState : { busy: false, error: "" };
  if (!account()) return null;
  return <>
    {(offline || pending > 0 || status.busy || status.error) && <div className={`mb-offline-status ${offline ? "is-offline" : ""} ${location.pathname.startsWith("/read/") ? "is-reader" : ""}`} role="status">
      {offline ? <CloudOff size={17}/> : <RefreshCw size={17} className={status.busy ? "animate-spin" : ""}/>}
      <span><strong>{offline ? "Modo offline" : status.busy ? "Sincronizando" : "Sincronização pendente"}</strong><small>{status.error || (offline ? `Apenas livros instalados.${pending ? ` ${pending} alterações salvas neste aparelho.` : ""}` : `${pending} alterações aguardando envio.`)}</small></span>
      {!offline && !status.busy && <button onClick={() => void synchronize()} aria-label="Sincronizar agora"><Wifi size={17}/></button>}
    </div>}
    {available && !installed && !offline && <button className="mb-install-app" disabled={busy} onClick={() => void installApp()}><Download size={16}/> Instalar myBooks</button>}
    {!available && !installed && !offline && <button className="mb-install-app" onClick={() => setHelp(!help)}><Download size={16}/> Instalar app</button>}
    {help && <div className="mb-install-help"><button aria-label="Fechar instruções" onClick={() => setHelp(false)}><X size={16}/></button><strong>Leve sua biblioteca com você</strong><p>No Android ou PC, use “Instalar aplicativo” no menu do navegador. No iPhone/iPad, abra no Safari, toque em Compartilhar e em “Adicionar à Tela de Início”.</p></div>}
  </>;
}
