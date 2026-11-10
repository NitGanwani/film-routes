import { describe, expect, it } from 'vitest';
import { filmTitle, originalTitleNote } from './titles.js';

const film = {
  title: 'El resplandor',
  titles: { es: 'El resplandor', en: 'The Shining' },
  originalTitle: 'The Shining',
};

describe('filmTitle', () => {
  it('uses the title in the language of the viewer', () => {
    expect(filmTitle(film, 'es')).toBe('El resplandor');
    expect(filmTitle(film, 'en')).toBe('The Shining');
  });

  it('does not depend on the language the route was written in', () => {
    const englishRoute = { ...film, title: 'The Shining' };

    expect(filmTitle(englishRoute, 'es')).toBe('El resplandor');
  });

  it('falls back to the route title for an unknown language', () => {
    expect(filmTitle(film, 'fr')).toBe('El resplandor');
  });
});

describe('originalTitleNote', () => {
  it('shows the original title when it differs from what is shown', () => {
    expect(originalTitleNote(film, 'El resplandor')).toBe('The Shining');
  });

  it('is nothing when the original is already the title shown', () => {
    expect(originalTitleNote(film, 'The Shining')).toBeNull();
    expect(originalTitleNote(film, ' the shining ')).toBeNull();
  });
});
