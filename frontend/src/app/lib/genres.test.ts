import { describe, expect, it } from 'vitest';
import { BOOK_GENRES, mergeCustomGenre } from './genres';

describe('book genres', () => {
  it('offers a broad curated list and an Other option', () => {
    expect(BOOK_GENRES.length).toBeGreaterThanOrEqual(20);
    expect(BOOK_GENRES).toContain('Fantasia');
    expect(BOOK_GENRES).toContain('Outros');
  });

  it('adds a custom genre only once', () => {
    expect(mergeCustomGenre(['Fantasia'], '  Dark Academia ')).toEqual(['Fantasia', 'Dark Academia']);
    expect(mergeCustomGenre(['Fantasia'], 'fantasia')).toEqual(['Fantasia']);
  });
});
