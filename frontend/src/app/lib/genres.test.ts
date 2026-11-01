import { describe, expect, it } from 'vitest';
import { BOOK_GENRES, mergeCustomGenre, bookGenres, hasBookGenre, shareBookGenre } from './genres';

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

it('parses legacy and multiple genres without duplicates and matches each independently', () => {
  expect(bookGenres('Fantasia')).toEqual(['Fantasia']);
  expect(bookGenres(' Fantasia, Romance; fantasia ')).toEqual(['Fantasia', 'Romance']);
  expect(bookGenres(null)).toEqual([]);
  expect(hasBookGenre('Fantasia, Romance', 'Romance')).toBe(true);
  expect(hasBookGenre('Romance histórico', 'Romance')).toBe(false);
  expect(shareBookGenre('Fantasia, Romance', 'Romance, Drama')).toBe(true);
  expect(shareBookGenre('Outros', 'Outros')).toBe(false);
});
