import { useEffect, useState } from "react";
import { communityApi, type Series } from "../lib/community";
import { fetchBooks } from "../lib/api";
import { getFullUrl, type Book } from "../lib/types";
import { Link } from "react-router";
import { toast } from "./Ui";
export function SeriesField({
  value,
  order,
  onChange,
}: {
  value: string;
  order: number;
  onChange: (id: string, order: number) => void;
}) {
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .catch(() => {});
  }, []);
  const [series, setSeries] = useState<Series[]>([]),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    communityApi<Series[]>("/series")
      .then(setSeries)
      .catch((e) => setError(e.message));
  }, []);
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const item = await communityApi<Series>("/series", "POST", { name });
      setSeries((current) => [
        ...current.filter((s) => s.id !== item.id),
        item,
      ]);
      onChange(item.id, order || 1);
      setName("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset className="mb-series-field">
      <legend>Saga / série</legend>
      <p>Conecte este volume aos outros livros da mesma história.</p>
      {error && <p role="alert">{error}</p>}
      <div className="mb-series-fields">
        <label>
          Saga
          <select
            className="mb-input"
            value={value}
            onChange={(e) => onChange(e.target.value, order || 1)}
          >
            <option value="">Livro independente</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {value && (
          <label>
            Volume
            <input
              aria-label="Volume na saga"
              className="mb-input"
              type="number"
              min="0.1"
              max="10000"
              step="0.1"
              value={order}
              onChange={(e) => onChange(value, Number(e.target.value))}
            />
          </label>
        )}
      </div>
      {value && (
        <div className="mb-series-field-preview">
          {books
            .filter((b) => b.seriesId === value)
            .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
            .map((b) => (
              <Link
                to={"/book/" + b.id}
                target="_blank"
                rel="noreferrer"
                key={b.id}
              >
                {b.coverImagePath && (
                  <img src={getFullUrl(b.coverImagePath)!} alt="" />
                )}
                <span>
                  Vol. {b.seriesOrder}
                  <strong>{b.title}</strong>
                </span>
              </Link>
            ))}
        </div>
      )}
      <div className="mb-series-create">
        <input
          aria-label="Nome da nova saga"
          className="mb-input"
          placeholder="Ou crie uma saga, ex.: O povo do ar"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="mb-btn mb-btn-outline"
          disabled={busy || !name.trim()}
          onClick={create}
        >
          {busy ? "Criando…" : "Criar saga"}
        </button>
      </div>
    </fieldset>
  );
}
