import { useState } from "react";
import { Check, Download, MonitorSmartphone } from "lucide-react";
import { installApp, useAppInstallation } from "../lib/installApp";
export function AppInstallation() {
  const { available, installed, busy, error } = useAppInstallation();
  const [help, setHelp] = useState(false);
  return <section className="mb-card p-5 space-y-4" aria-labelledby="app-install-heading">
    <div><h2 id="app-install-heading" className="flex items-center gap-2 text-[16px] font-bold"><MonitorSmartphone size={19}/> Instalar aplicativo</h2><p className="text-[12.5px] text-[var(--text-3)] mt-1">Abra o myBooks em uma janela própria, com ícone na área de trabalho e acesso aos livros instalados sem internet.</p></div>
    <button className="mb-btn mb-btn-primary" disabled={installed || busy} onClick={async () => { if (available) await installApp(); else setHelp(true); }}>{installed ? <Check size={17}/> : <Download size={17}/>}{installed ? "myBooks instalado" : busy ? "Abrindo instalação…" : "Instalar myBooks"}</button>
    {(help || error) && <div className="rounded-2xl bg-[var(--surface-2)] p-4 text-[13px] leading-relaxed" role="status">{error && <p>{error}</p>}<strong>No Google Chrome do computador</strong><p>Abra o menu ⋮ no canto superior direito → Transmitir, salvar e compartilhar → Instalar página como app. Em algumas versões, a opção aparece como “Instalar myBooks”. Também pode aparecer um ícone de instalação na barra de endereço.</p><p className="mt-2 text-[var(--text-3)]">Se o app já estiver instalado, abra-o pelo menu de aplicativos do computador. No iPhone/iPad, use Safari → Compartilhar → Adicionar à Tela de Início.</p></div>}
  </section>;
}
