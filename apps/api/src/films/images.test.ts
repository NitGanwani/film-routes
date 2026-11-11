import { describe, expect, it } from 'vitest';
import { filmImages, imageUrl, IMAGE_SIZES } from './images.js';

describe('imageUrl', () => {
  it('builds the TMDB URL for every size it serves', () => {
    for (const size of IMAGE_SIZES) {
      expect(imageUrl('/abc.jpg', size)).toBe(
        `https://image.tmdb.org/t/p/${size}/abc.jpg`,
      );
    }
  });

  it('is null when the film has no image', () => {
    expect(imageUrl(null, 'w342')).toBeNull();
  });
});

describe('filmImages', () => {
  it('gives the poster at two sizes and a wide backdrop', () => {
    expect(
      filmImages({ posterPath: '/p.jpg', backdropPath: '/b.jpg' }),
    ).toEqual({
      posterUrl: 'https://image.tmdb.org/t/p/w342/p.jpg',
      posterUrlSmall: 'https://image.tmdb.org/t/p/w185/p.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/b.jpg',
    });
  });

  it('leaves each one null when TMDB has none', () => {
    expect(filmImages({ posterPath: null, backdropPath: null })).toEqual({
      posterUrl: null,
      posterUrlSmall: null,
      backdropUrl: null,
    });
  });
});
