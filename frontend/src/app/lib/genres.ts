export const BOOK_GENRES = [
  'Fantasia', 'Fantasia urbana', 'Romance', 'Romance contemporâneo', 'Romance histórico',
  'Romantasia', 'Ficção científica', 'Distopia', 'Mistério', 'Suspense', 'Terror',
  'Dark academia', 'Aventura', 'Ação', 'Drama', 'Ficção histórica', 'Clássicos',
  'Realismo mágico', 'Literatura brasileira', 'Poesia', 'Contos', 'Biografia',
  'Autobiografia', 'Não ficção', 'Desenvolvimento pessoal', 'História', 'Filosofia',
  'Young adult', 'New adult', 'Infantojuvenil', 'Graphic novel', 'Mangá', 'LGBTQIA+',
  'Outros',
] as const;

export function mergeCustomGenre(genres: string[], custom: string): string[] {
  const value = custom.trim().slice(0, 40);
  if (!value || genres.some((genre) => genre.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) return genres;
  return [...genres, value];
}

/** Books keep their legacy text field; each comma-separated genre is independently searchable. */
export function bookGenres(value: string | null | undefined): string[] {
  const unique: string[] = [];
  for (const genre of (value || '').split(/[,;]/)) {
    const clean = genre.trim();
    if (clean && !unique.some(item => item.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'))) unique.push(clean);
  }
  return unique;
}
export function hasBookGenre(value: string | null | undefined, genre: string): boolean {
  return bookGenres(value).some(item => item.toLocaleLowerCase('pt-BR') === genre.toLocaleLowerCase('pt-BR'));
}
export function shareBookGenre(a: string, b: string): boolean {
  return bookGenres(a).some(genre => genre !== 'Outros' && hasBookGenre(b, genre));
}
