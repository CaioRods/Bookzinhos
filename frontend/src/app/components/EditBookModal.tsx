import { SeriesField } from "./SeriesField";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { editBook, editBookWithCover } from "../lib/api";
import { getFullUrl, getCoverGradient } from "../lib/types";
import type { Book } from "../lib/types";
import { Modal, toast } from "./Ui";

const GENRES = ["Romance", "Suspense", "Ficção", "Fantasia", "Distopia", "Autoconhecimento", "Desenvolvimento", "História", "Poesia", "Outros"];
const COLORS = ["lavender-mint", "peach-lavender", "mint-sky", "blush-lavender", "peach-mint", "lemon-peach", "sky-mint", "lavender-peach"];

interface Props {
  book: Book;
  onClose: () => void;
  onSaved: (updated: Book) => void;
}

export function EditBookModal({ book, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    seriesId: book.seriesId || "", seriesOrder: book.seriesOrder || 1,
    title: book.title,
    author: book.author,
    description: book.description,
    genre: book.genre,
    coverColor: book.coverColor,
    publisher: book.publisher || "",
    publishedYear: book.publishedYear || "",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(getFullUrl(book.coverImagePath));
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    setCoverFile(file);
    objectUrlRef.current = URL.createObjectURL(file);
    setCoverPreview(objectUrlRef.current);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setIsSaving(true);
    try {
      // Com arquivo novo, o envio precisa ser multipart — JSON não carrega o
      // binário da capa (era por isso que trocar a capa não fazia efeito).
      const updated = coverFile
        ? await editBookWithCover(book.id, form, coverFile)
        : await editBook(book.id, form);
      onSaved(updated);
      toast("Livro atualizado para todos.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar livro"
      description="As alterações aparecem para todos os leitores."
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={isSaving} className="mb-btn mb-btn-outline">Cancelar</button>
          <button onClick={handleSave} disabled={!form.title.trim() || isSaving} className="mb-btn mb-btn-primary">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar alterações
          </button>
        </>
      }
    >
      <div className="space-y-5 mb-book-edit-form">
        <div className="flex gap-4 items-start">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 w-24 aspect-[2/3] rounded-lg overflow-hidden shadow-[var(--shadow-book)] relative group cursor-pointer"
          >
            {coverPreview ? (
              <img src={coverPreview} className="w-full h-full object-cover" alt="Capa do livro" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)} flex items-center justify-center`}>
                <ImagePlus className="w-7 h-7 text-black/30" />
              </div>
            )}
            <span className="absolute inset-0 bg-black/45 text-white text-[11px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              Trocar capa
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <label htmlFor="edit-title" className="mb-label">Título</label>
              <input
                id="edit-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mb-input"
              />
            </div>
            <div>
              <label htmlFor="edit-author" className="mb-label">Autor</label>
              <input
                id="edit-author"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="mb-input"
              />
            </div>
          </div>
        </div>

        <div>
          <span className="mb-label">Gênero</span>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setForm({ ...form, genre: g })}
                className={`mb-btn mb-btn-sm ${form.genre === g ? "mb-btn-primary" : "mb-btn-outline"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {!coverPreview && (
          <div>
            <span className="mb-label">Cor da capa (quando não há imagem)</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Cor ${c}`}
                  onClick={() => setForm({ ...form, coverColor: c })}
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${getCoverGradient({ id: c, coverColor: c })} border-2 transition-transform cursor-pointer ${
                    form.coverColor === c ? "border-[var(--primary)] scale-110" : "border-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-publisher" className="mb-label">Editora</label>
            <input
              id="edit-publisher"
              value={form.publisher}
              onChange={(e) => setForm({ ...form, publisher: e.target.value })}
              placeholder="Ex.: Arqueiro"
              className="mb-input"
            />
          </div>
          <div>
            <label htmlFor="edit-year" className="mb-label">Publicado em</label>
            <input
              id="edit-year"
              value={form.publishedYear}
              onChange={(e) => setForm({ ...form, publishedYear: e.target.value })}
              placeholder="Ex.: 2023"
              className="mb-input"
            />
          </div>
        </div>

        <SeriesField value={form.seriesId} order={form.seriesOrder} onChange={(seriesId,seriesOrder)=>setForm({...form,seriesId,seriesOrder})} />
        <div>
          <label htmlFor="edit-desc" className="mb-label">Sinopse</label>
          <textarea
            id="edit-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder="Do que trata o livro?"
            className="mb-input resize-y leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  );
}
