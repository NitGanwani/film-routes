import { describe, expect, it } from 'vitest';
import { backdropSources } from './images.js';

describe('backdropSources', () => {
  it('offers the same image at w780 and w1280', () => {
    const url = 'https://image.tmdb.org/t/p/w1280/abc.jpg';

    expect(backdropSources(url)).toEqual({
      src: url,
      srcSet:
        'https://image.tmdb.org/t/p/w780/abc.jpg 780w, https://image.tmdb.org/t/p/w1280/abc.jpg 1280w',
    });
  });

  it('keeps an address of another shape as it is', () => {
    const url = 'https://example.com/cover.jpg';

    expect(backdropSources(url)).toEqual({ src: url, srcSet: undefined });
  });
});
