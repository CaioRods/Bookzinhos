import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router";
import { ArrowLeft, Send, Settings } from "lucide-react";
import { fetchChat, sendMessage, setNickname, fetchBooks, fetchConversations, fetchUserProfile } from "../lib/api";
import { getFullUrl } from "../lib/types";
import type { Book, ChatMessage, ChatConversation, UserProfile } from "../lib/types";
import { getUsername } from "../lib/session";
import { requireAuth } from "../lib/authGate";
import { Avatar, Modal, toast } from "../components/Ui";
import { chatConversationTarget, chatOrigin, rememberChatOrigin } from "../lib/chatNavigation";

const QUICK_EMOTES = ["🐼", "💕", "✨", "📖", "📚", "🤍", "🌸", "🍭", "🎈"];

export function Chat() {
  const { otherUser } = useParams<{ otherUser: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const me = getUsername();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nickname, setNicknameState] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const state = location.state as { chatOrigin?: string; fromChatSwitch?: boolean } | null;
    if (!state?.fromChatSwitch && state?.chatOrigin) rememberChatOrigin(state.chatOrigin);
  }, [location.state]);

  const refreshConversations = useCallback(() => fetchConversations().then(setConversations).catch(() => {}), []);

  const refresh = useCallback(async () => {
    if (!otherUser) return;
    try {
      const chat = await fetchChat(otherUser);
      setMessages(chat.messages || []);
      setNicknameState(chat.nickname);
      await refreshConversations();
    } catch {
      /* silencioso: a próxima rodada tenta de novo */
    }
  }, [otherUser, refreshConversations]);

  useEffect(() => {
    if (!otherUser) return;
    refresh().then(() => setNewNickname((n) => n || ""));
    fetchBooks().then(setBooks).catch(() => setBooks([]));
    fetchUserProfile(otherUser).then(setOtherProfile).catch(() => setOtherProfile(null));
    refreshConversations();

    // Só busca mensagens novas com a conversa aberta na tela.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [otherUser, refresh, refreshConversations]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride || inputValue).trim();
    if (!text || !otherUser) return;
    if (!requireAuth("enviar mensagens")) return;
    if (!textOverride) setInputValue("");
    try {
      await sendMessage(otherUser, text);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao enviar.", "error");
    }
  };

  const handleSetNickname = async () => {
    if (!otherUser) return;
    try {
      await setNickname(otherUser, newNickname.trim());
      setNicknameState(newNickname.trim() || null);
      setShowSettings(false);
      toast("Apelido salvo.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar apelido.", "error");
    }
  };

  return (
    <div className="mb-chat-stage h-screen bg-background">
      <div className="mb-chat-shell">
      <aside className="mb-chat-list" aria-label="Outras conversas">
        <div className="mb-chat-list-heading"><button onClick={() => navigate(chatOrigin(), { replace: true })} aria-label="Voltar" className="mb-btn mb-btn-ghost mb-btn-icon"><ArrowLeft className="w-5 h-5" /></button><div><strong>Mensagens</strong><small>{conversations.reduce((total, item) => total + item.unreadCount, 0)} não lidas</small></div></div>
        <div className="mb-chat-list-scroll">{conversations.map((conversation) => <Link key={conversation.username} to={chatConversationTarget(conversation.username)} replace className={`mb-chat-contact ${conversation.username.toLowerCase() === otherUser?.toLowerCase() ? "is-active" : ""}`}><span className="relative"><Avatar emoji={conversation.avatar} size="md" />{conversation.unreadCount > 0 && <b>{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</b>}</span><span><strong>{conversation.displayName}</strong><small>{conversation.lastMessage}</small></span><time>{new Date(conversation.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</time></Link>)}{conversations.length === 0 && <p className="mb-chat-list-empty">Suas conversas aparecerão aqui.</p>}</div>
      </aside>
      <div className="mb-chat flex flex-col bg-[var(--surface)]">
      <header className="mb-chat-header flex-shrink-0 h-16 px-3 flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar emoji={otherProfile?.avatar} size="sm" username={otherProfile?.username} />
          <Link to={`/user/${encodeURIComponent(otherUser || "")}`} className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-foreground truncate">{otherProfile?.displayName || otherUser}</span>
              {nickname && <span className="mb-chip mb-chip-primary">@{nickname}</span>}
            </span>
            <span className="block text-[11.5px] text-[var(--text-3)]">Ver perfil</span>
          </Link>
        </div>
        <button
          onClick={() => { setNewNickname(nickname || ""); setShowSettings(true); }}
          aria-label="Configurar apelido"
          className="mb-btn mb-btn-ghost mb-btn-icon"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div ref={scrollRef} className="mb-chat-messages flex-1 overflow-y-auto px-4 py-5 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-center text-[13px] text-[var(--text-3)] py-10">
            Nenhuma mensagem ainda. Que tal indicar um livro?
          </p>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.sender?.toLowerCase() === me?.toLowerCase();
          const book = msg.shared_book_id ? books.find((b) => b.id === msg.shared_book_id) : null;

          return (
            <div key={msg.id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  isMe
                    ? "bg-[var(--primary)] text-white rounded-br-sm"
                    : "bg-[var(--surface)] border border-[var(--line)] text-foreground rounded-bl-sm"
                }`}
              >
                {book && (
                  <Link
                    to={`/book/${book.id}`}
                    className={`flex items-center gap-2.5 p-2 rounded-xl mb-2 transition-colors ${
                      isMe ? "bg-white/15 hover:bg-white/25" : "bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
                    }`}
                  >
                    <div className="w-9 aspect-[2/3] rounded overflow-hidden flex-shrink-0 bg-black/10">
                      {book.coverImagePath && (
                        <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? "text-white/70" : "text-[var(--text-3)]"}`}>
                        Recomendação
                      </p>
                      <p className="text-[12.5px] font-semibold truncate">{book.title}</p>
                    </div>
                  </Link>
                )}
                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10.5px] mt-1 text-right ${isMe ? "text-white/60" : "text-[var(--text-3)]"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-shrink-0 border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="flex gap-1 px-3 py-1.5 overflow-x-auto no-scrollbar">
          {QUICK_EMOTES.map((emote) => (
            <button
              key={emote}
              onClick={() => handleSend(emote)}
              className="text-xl p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer select-none"
            >
              {emote}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escreva uma mensagem…"
            aria-label="Mensagem"
            className="mb-input flex-1"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim()}
            aria-label="Enviar"
            className="mb-btn mb-btn-primary mb-btn-icon"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      </div></div>
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Apelido"
        description={`Só você vê o apelido que der para ${otherUser}.`}
        size="sm"
        footer={
          <>
            <button onClick={() => setShowSettings(false)} className="mb-btn mb-btn-outline">Cancelar</button>
            <button onClick={handleSetNickname} className="mb-btn mb-btn-primary">Salvar</button>
          </>
        }
      >
        <input
          value={newNickname}
          onChange={(e) => setNewNickname(e.target.value)}
          placeholder="Ex.: Panda, Amor de livro…"
          className="mb-input"
        />
      </Modal>
    </div>
  );
}
