import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Check, Copy, HeartHandshake } from "lucide-react";
import { DONATION_SUPPORT } from "../components/DonationCampaign";

export function Donate() {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(DONATION_SUPPORT.pixKey);
      setStatus("Chave copiada!");
    } catch { setStatus("Não foi possível copiar. Selecione a chave e copie manualmente."); }
  };
  return <article className="mb-donation-page">
    <Link className="mb-btn mb-btn-ghost" to="/"><ArrowLeft size={18} /> Voltar ao myBooks</Link>
    <header><span className="mb-support-heart"><HeartHandshake /></span><p className="mb-support-kicker">Juntos, além das páginas</p><h1>Leitura que transforma vidas.</h1><p>Queremos fazer a diferença, sem fins lucrativos. Um pequeno gesto pode ajudar a escrever uma nova história.</p></header>
    <section><h2>Para onde vai o dinheiro?</h2><p>A campanha do myBooks tem como destino o GRAACC, instituição beneficente que atua no tratamento de crianças e adolescentes com câncer. Nosso compromisso é destinar integralmente o valor arrecadado nesta campanha à instituição, sem lucro para o myBooks.</p><p>O Pix abaixo é o canal de arrecadação informado pelo myBooks para posterior repasse. Não o apresentamos como chave oficial do GRAACC. Esta é uma iniciativa independente; não afirmamos parceria ou vínculo oficial com o instituto.</p><a className="mb-btn mb-btn-ghost" href="https://graacc.org.br/" target="_blank" rel="noopener noreferrer">Conhecer o GRAACC ↗</a></section>
    <section><h2>Por que fazemos isso?</h2><p>Acreditamos que compartilhar histórias também pode inspirar cuidado e solidariedade. Criamos esta campanha porque queremos fazer a diferença sem obter lucro com as doações. Sua contribuição é espontânea e não é usada para liberar recursos ou conteúdos do aplicativo.</p></section>
    <section><h2>Como contribuir</h2><p>Doe qualquer valor pelo Pix, no aplicativo do seu banco. Antes de confirmar, confira o nome do destinatário e o valor da transferência.</p><div className="mb-support-pix"><span>Chave Pix da campanha myBooks</span><strong>{DONATION_SUPPORT.pixKey}</strong><button className="mb-btn mb-btn-primary" onClick={copy}>{status === "Chave copiada!" ? <Check size={18} /> : <Copy size={18} />} Copiar chave Pix</button></div><p role="status" aria-live="polite">{status}</p></section>
    <section><h2>Transparência</h2><p>Esta página apresenta o propósito e o compromisso da campanha. Ainda não há comprovantes de repasse publicados aqui. A chave Pix, por si só, não comprova que um repasse foi realizado.</p></section>
    <footer>Doar é opcional. Ler, descobrir livros e participar do myBooks continua independente de qualquer contribuição. Obrigado por fazer parte desta história.</footer>
  </article>;
}
