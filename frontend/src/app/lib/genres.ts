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
