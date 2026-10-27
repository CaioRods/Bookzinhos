import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  ImagePlus,
  BookOpen,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import {
  communityApi,
  type Reaction,
  type SocialPost,
  type SocialComment,
} from "../lib/community";
import { getUsername, isAdmin, getAvatar } from "../lib/session";
import { getFullUrl, type Book, type UserProfile } from "../lib/types";
import { fetchAllUsers, sendMessage } from "../lib/api";
import { requireAuth } from "../lib/authGate";
import { Avatar, Modal, toast, ConfirmDialog } from "./Ui";
import { prepareSocialImage } from "../lib/socialImage";
import { BookPicker } from "./BookPicker";
const REACTIONS: Record<Reaction, string> = {
  heart: "❤️",
  panda: "🐼",
  sad: "😢",
  moved: "🥹",
};
const REACTION_NAMES: Record<Reaction, string> = {
  heart: "Coração",
  panda: "Panda",
  sad: "Triste",
  moved: "Emocionado",
};
export function ReactionButton({
  target,
  onChange,
}: {
  target: Pick<SocialComment, "id" | "reactions" | "myReaction">;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    held = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const react = async (reaction: Reaction) => {
    if (!requireAuth("reagir a publicações")) return;
    setBusy(true);
    try {
      await communityApi("/community/reactions/" + target.id, "PUT", {
        reaction: target.myReaction === reaction ? null : reaction,
      });
      setOpen(false);
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <div className="mb-reaction-wrap">
      <button
        disabled={busy}
        aria-label={target.myReaction ? "Alterar reação" : "Curtir"}
        aria-pressed={!!target.myReaction}
        className={target.myReaction ? "is-reacted" : ""}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onPointerDown={() => {
          held.current = false;
          timer.current = setTimeout(() => {
            held.current = true;
            setOpen(true);
          }, 450);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={() => {
          if (!held.current) react("heart");
        }}
      >
        {target.myReaction ? (
          <span>{REACTIONS[target.myReaction]}</span>
        ) : (
          <Heart size={19} />
        )}
        <span>
          {Object.values(target.reactions).reduce(
            (sum, n) => sum + (n || 0),
            0,
          ) || ""}
        </span>
      </button>
      <button
        aria-label="Escolher outra reação"
        aria-expanded={open}
        className="mb-reaction-more"
        onClick={() => setOpen(!open)}
      >
        ⌄
      </button>
      {open && (
        <div className="mb-reaction-menu" role="group" aria-label="Reações">
          {(Object.keys(REACTIONS) as Reaction[]).map((key) => (
            <button
              key={key}
              title={REACTION_NAMES[key]}
              aria-label={REACTION_NAMES[key]}
              onClick={() => react(key)}
              disabled={busy}
            >
              {REACTIONS[key]}
            </button>
          ))}
          <button aria-label="Fechar reações" onClick={() => setOpen(false)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
export function PostComposer({
  book,
  onPublished,
  onClose,
}: {
  book?: Book;
  onPublished: () => void;
  onClose?: () => void;
}) {
  const [text, setText] = useState(""),
    [selected, setSelected] = useState<Book | undefined>(book),
    [picker, setPicker] = useState(false),
    [images, setImages] = useState<{ file: File; url: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    current = useRef(images);
  current.current = images;
  useEffect(
    () => () => {
      current.current.forEach((i) => URL.revokeObjectURL(i.url));
    },
    [],
  );
  const add = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    if (list.length + images.length > 8) {
      setError("Adicione até 8 imagens.");
      return;
    }
    if (
      list.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
            f.type,
          ) || f.size > 4 * 1024 * 1024,
      )
    ) {
      setError("Use imagens JPG, PNG, WebP ou AVIF de até 4 MB.");
      return;
    }
    setError("");
    setImages([
      ...images,
      ...list.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  };
  const publish = async () => {
    if (!requireAuth("publicar na comunidade")) return;
    setBusy(true);
    setError("");
    try {
      const prepared = await Promise.all(
        images.map((i) => prepareSocialImage(i.file)),
      );
      const data = new FormData();
      data.set("content", text);
      if (selected) data.set("bookId", selected.id);
      if (book) data.set("gallery", "true");
      prepared.forEach((file) => data.append("images", file));
      await communityApi("/community/posts", "POST", data);
      setText("");
      setImages([]);
      images.forEach((i) => URL.revokeObjectURL(i.url));
      onPublished();
      onClose?.();
      toast("Sua publicação já está na comunidade.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mb-composer">
      <header>
        <Avatar size="sm" emoji={getAvatar()} />
        <div>
          <strong>Uma história merece outra conversa.</strong>
          <small>Compartilhe uma descoberta com a comunidade.</small>
        </div>
      </header>
      <textarea
        aria-label="Texto da publicação"
        placeholder="O que essa leitura despertou em você?"
        value={text}
        maxLength={5000}
        onChange={(e) => setText(e.target.value)}
      />
      {images.length > 0 && (
        <div className="mb-composer-previews">
          {images.map((image, i) => (
            <div key={image.url}>
              <img src={image.url} alt={"Imagem " + (i + 1)} />
              <button
                disabled={busy}
                aria-label={"Remover imagem " + (i + 1)}
                onClick={() => {
                  URL.revokeObjectURL(image.url);
                  setImages(images.filter((_, index) => index !== i));
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <div className="mb-attached-book">
          <BookOpen size={16} />
          <span>{selected.title}</span>
          {!book && (
            <button
              aria-label="Desvincular livro"
              onClick={() => setSelected(undefined)}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <footer>
        <button
          disabled={busy}
          onClick={() => input.current?.click()}
          className="mb-btn mb-btn-ghost"
        >
          <ImagePlus size={18} /> Imagens
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        {!book && (
          <button
            disabled={busy}
            onClick={() => setPicker(true)}
            className="mb-btn mb-btn-ghost"
          >
            <BookOpen size={18} /> Livro
          </button>
        )}
        <button
          className="mb-btn mb-btn-primary"
          disabled={busy || (!text.trim() && !images.length)}
          onClick={publish}
        >
          {busy ? "Publicando…" : "Publicar"}
          <Send size={15} />
        </button>
      </footer>
      {error && (
        <p role="alert" className="mb-editor-error">
          {error}
        </p>
      )}
      {picker && (
        <BookPicker
          selectedId={selected?.id || ""}
          onSelect={setSelected}
          onClose={() => setPicker(false)}
        />
      )}
    </section>
  );
}
function SharePost({
  post,
  onClose,
}: {
  post: SocialPost;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false);
  const url = window.location.origin + "/social/post/" + post.id;
  useEffect(() => {
    fetchAllUsers()
      .then(setUsers)
      .catch(() => {});
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copiado.");
    } catch {
      toast("Não foi possível copiar o link.", "error");
    }
  };
  const send = async (username: string) => {
    if (!requireAuth("compartilhar no chat")) return;
    setBusy(true);
    try {
      await sendMessage(
        username,
        `Veja esta publicação de ${post.username}: ${url}`,
      );
      toast("Publicação enviada.");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Compartilhar publicação">
      <div className="mb-share-options">
        <button className="mb-btn mb-btn-primary" onClick={copy}>
          Copiar link
        </button>
        {!!navigator.share && (
          <button
            className="mb-btn mb-btn-outline"
            onClick={() =>
              navigator
                .share({ title: "Publicação de " + post.username, url })
                .catch(() => {})
            }
          >
            Outros aplicativos
          </button>
        )}
      </div>
      <input
        className="mb-input"
        aria-label="Link da publicação"
        value={url}
        readOnly
      />
      <input
        className="mb-input mt-4"
        placeholder="Enviar para um leitor…"
        aria-label="Pesquisar destinatário"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mb-share-readers">
        {users
          .filter(
            (u) =>
              u.username !== getUsername() &&
              u.username.toLowerCase().includes(search.toLowerCase()),
          )
          .map((u) => (
            <button
              disabled={busy}
              key={u.username}
              onClick={() => send(u.username)}
            >
              <Avatar size="sm" emoji={u.avatar} />
              {u.username}
              <Send size={16} />
            </button>
          ))}
      </div>
    </Modal>
  );
}
export function CommunityPost({
  post,
  onChange,
  detail = false,
  initialImage = 0,
}: {
  post: SocialPost;
  onChange: () => void;
  detail?: boolean;
  initialImage?: number;
}) {
  const navigate = useNavigate();
  const [image, setImage] = useState(initialImage),
    [share, setShare] = useState(false),
    [reply, setReply] = useState<SocialComment | null>(null),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    if (!requireAuth("comentar")) return;
    setBusy(true);
    setError("");
    try {
      await communityApi("/community/posts/" + post.id + "/comments", "POST", {
        content: comment,
        parentId: reply?.id || null,
      });
      setComment("");
      setReply(null);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const repost = async () => {
    if (!requireAuth("republicar")) return;
    setBusy(true);
    try {
      await communityApi("/community/posts/" + post.id + "/repost", "POST");
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const renderComment = (item: SocialComment, depth = 0): React.ReactNode => (
    <div
      key={item.id}
      className={"mb-social-comment " + (depth ? "is-reply" : "")}
    >
      <div>
        <Avatar size="sm" emoji={item.avatar} username={item.username} />
        <div>
          <strong>{item.username}</strong>
          <p>{item.content}</p>
          <footer>
            <ReactionButton target={item} onChange={onChange} />
            <button onClick={() => setReply(item)}>Responder</button>
            <time>{new Date(item.created_at).toLocaleDateString("pt-BR")}</time>
          </footer>
        </div>
      </div>
      {post.comments
        .filter((c) => c.parent_id === item.id)
        .map((c) => renderComment(c, depth + 1))}
    </div>
  );
  return (
    <article
      className={"mb-social-post " + (detail ? "is-detail" : "")}
      onClick={(event) => {
        if (
          !detail &&
          !(event.target as HTMLElement).closest("a,button,input,textarea,form")
        )
          navigate("/social/post/" + post.id);
      }}
    >
      <header>
        <Avatar emoji={post.avatar} username={post.username} size="sm" />
        <Link to={"/user/" + encodeURIComponent(post.username)}>
          <strong>{post.username}</strong>
          <time>
            {new Date(post.created_at).toLocaleString("pt-BR", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </Link>
        {(post.username === getUsername() || isAdmin()) && (
          <button
            aria-label="Excluir publicação"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={17} />
          </button>
        )}
      </header>
      {!!post.repostedBy?.length && (
        <p className="mb-reposted">
          <Repeat2 size={13} /> Republicado por {post.repostedBy.join(", ")}
        </p>
      )}
      {post.content && <p className="mb-post-text">{post.content}</p>}
      {post.book && (
        <Link to={"/book/" + post.book.id} className="mb-post-book">
          {post.book.cover_image_path && (
            <img src={getFullUrl(post.book.cover_image_path)!} alt="" />
          )}
          <span>
            <small>NESTA CONVERSA</small>
            <strong>{post.book.title}</strong>
            <small>{post.book.author}</small>
          </span>
          <ChevronRight size={17} />
        </Link>
      )}
      {post.images.length > 0 && (
        <div className="mb-post-gallery">
          <Link
            to={"/social/post/" + post.id}
            state={{ image }}
            aria-label="Expandir imagem da publicação"
            onClick={(e) => {
              if (detail) e.preventDefault();
            }}
          >
            <img
              src={getFullUrl(post.images[image] || post.images[0])!}
              alt={`Imagem ${image + 1} da publicação de ${post.username}`}
              loading="lazy"
            />
          </Link>
          {post.images.length > 1 && (
            <>
              <button
                className="is-prev"
                aria-label="Imagem anterior"
                onClick={() =>
                  setImage(
                    (image - 1 + post.images.length) % post.images.length,
                  )
                }
              >
                <ChevronLeft />
              </button>
              <button
                className="is-next"
                aria-label="Próxima imagem"
                onClick={() => setImage((image + 1) % post.images.length)}
              >
                <ChevronRight />
              </button>
              <span>
                {image + 1} / {post.images.length}
              </span>
            </>
          )}
        </div>
      )}
      <div className="mb-post-toolbar">
        <ReactionButton target={post} onChange={onChange} />
        <Link aria-label="Ver comentários" to={"/social/post/" + post.id}>
          <MessageCircle size={19} />
          {post.comments.length || ""}
        </Link>
        <button
          disabled={busy}
          aria-label="Republicar"
          aria-pressed={post.repostedByMe}
          className={post.repostedByMe ? "is-reacted" : ""}
          onClick={repost}
        >
          <Repeat2 size={19} />
          {post.repostCount || ""}
        </button>
        <button
          aria-label="Compartilhar publicação"
          onClick={() => setShare(true)}
        >
          <Share2 size={19} />
        </button>
        {!detail && (
          <Link className="mb-post-open" to={"/social/post/" + post.id}>
            Ver conversa
          </Link>
        )}
      </div>
      {detail && (
        <section className="mb-post-comments">
          <h2>A conversa</h2>
          {post.comments
            .filter((c) => !c.parent_id)
            .map((c) => renderComment(c))}
          {!post.comments.length && (
            <p className="mb-muted">
              Seja a primeira pessoa a entrar nessa conversa.
            </p>
          )}
          {reply && (
            <div className="mb-replying">
              Respondendo a {reply.username}
              <button
                aria-label="Cancelar resposta"
                onClick={() => setReply(null)}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              aria-label="Seu comentário"
              placeholder={
                reply ? "Escreva sua resposta…" : "Entre na conversa…"
              }
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              disabled={busy || !comment.trim()}
              className="mb-btn mb-btn-primary"
              aria-label="Enviar comentário"
            >
              <Send size={17} />
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </section>
      )}
      {share && <SharePost post={post} onClose={() => setShare(false)} />}
      <ConfirmDialog
        open={deleting}
        title="Excluir publicação?"
        description="A publicação e a conversa serão removidas."
        confirmLabel="Excluir"
        destructive
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          try {
            await communityApi("/community/posts/" + post.id, "DELETE");
            setDeleting(false);
            onChange();
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }}
      />
    </article>
  );
}
export function CommunityTimeline({ scope = "all" }: { scope?: string }) {
  const [posts, setPosts] = useState<SocialPost[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(0);
  const refresh = () => setPage((p) => p + 1);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setPage((p) => p + 1);
    };
    const timer = window.setInterval(update, 45000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    communityApi<SocialPost[]>("/community/posts?scope=" + scope)
      .then((data) => {
        if (alive) {
          setPosts(data);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, page]);
  return (
    <div className="mb-community-timeline">
      <PostComposer onPublished={refresh} />
      {error && (
        <p role="alert" className="mb-editor-error">
          {error}
          <button className="mb-btn mb-btn-ghost" onClick={refresh}>
            Tentar novamente
          </button>
        </p>
      )}
      {loading && <p className="mb-muted">Carregando as conversas…</p>}
      {!loading && !error && !posts.length && (
        <div className="mb-social-empty">
          <BookOpen size={30} />
          <h2>As próximas histórias começam aqui.</h2>
          <p>
            Publique uma imagem, uma descoberta ou uma pergunta sobre sua
            leitura.
          </p>
        </div>
      )}
      {posts.map((post) => (
        <CommunityPost key={post.id} post={post} onChange={refresh} />
      ))}
      {posts.length >= 100 && (
        <button
          className="mb-btn mb-btn-outline"
          onClick={async () => {
            try {
              const older = await communityApi<SocialPost[]>(
                "/community/posts?scope=" +
                  scope +
                  "&before=" +
                  posts[posts.length - 1].created_at,
              );
              setPosts((current) => [
                ...current,
                ...older.filter((p) => !current.some((c) => c.id === p.id)),
              ]);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Carregar publicações anteriores
        </button>
      )}
    </div>
  );
}
export function PostPage() {
  const { postId } = useParams();
  const [post, setPost] = useState<SocialPost | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    communityApi<SocialPost>("/community/posts/" + postId)
      .then((p) => {
        if (alive) setPost(p);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [postId, version]);
  return (
    <div className="mb-screen mb-post-page">
      <Link className="mb-btn mb-btn-ghost" to="/social">
        <ChevronLeft size={17} /> Comunidade
      </Link>
      {error ? (
        <p role="alert">{error}</p>
      ) : post ? (
        <CommunityPost
          post={post}
          detail
          onChange={() => setVersion((v) => v + 1)}
        />
      ) : (
        <p>Carregando publicação…</p>
      )}
    </div>
  );
}
export function BookGallery({ book }: { book: Book }) {
  const [posts, setPosts] = useState<SocialPost[]>([]),
    [active, setActive] = useState<{ post: SocialPost; index: number } | null>(
      null,
    ),
    [compose, setCompose] = useState(false),
    [version, setVersion] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    communityApi<SocialPost[]>(
      "/community/posts?bookId=" + encodeURIComponent(book.id),
    )
      .then((data) => {
        if (alive) {
          setPosts(data.filter((p) => p.images.length));
          setError("");
          setActive((current) => {
            if (!current) return null;
            const post = data.find((p) => p.id === current.post.id);
            return post ? { ...current, post } : null;
          });
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [book.id, version]);
  return (
    <section className="mb-book-gallery">
      <header>
        <div>
          <p className="mb-eyebrow">PELO OLHAR DE QUEM LÊ</p>
          <h2>Entre imagens e histórias.</h2>
          <p>Arte, edições e momentos inspirados neste livro.</p>
        </div>
        {isAdmin() && (
          <button
            className="mb-btn mb-btn-outline"
            onClick={() => setCompose(true)}
          >
            <ImagePlus size={17} /> Publicar imagem
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="mb-editor-error">
          {error}
        </p>
      )}
      <div className="mb-book-gallery-rail">
        {posts.flatMap((post) =>
          post.images.map((url, index) => (
            <button
              key={post.id + index}
              onClick={() => setActive({ post, index })}
            >
              <img
                src={getFullUrl(url)!}
                alt={
                  post.content || "Imagem compartilhada por " + post.username
                }
                loading="lazy"
              />
              <span>{post.username}</span>
            </button>
          )),
        )}
        {!posts.length && !error && (
          <div className="mb-gallery-empty">
            <ImagePlus size={30} />
            <p>Esta história ainda não tem imagens.</p>
            <small>As imagens publicadas pela curadoria aparecerão aqui.</small>
          </div>
        )}
      </div>
      {active && (
        <Modal
          open
          size="xl"
          title="Um olhar sobre este livro"
          onClose={() => setActive(null)}
        >
          <div className="mb-gallery-lightbox">
            <CommunityPost
              post={active.post}
              initialImage={active.index}
              detail
              onChange={() => setVersion((v) => v + 1)}
            />
          </div>
        </Modal>
      )}
      {compose && (
        <Modal
          open
          size="lg"
          title="Publicar sobre este livro"
          onClose={() => setCompose(false)}
        >
          <PostComposer
            book={book}
            onClose={() => setCompose(false)}
            onPublished={() => setVersion((v) => v + 1)}
          />
        </Modal>
      )}
    </section>
  );
}
