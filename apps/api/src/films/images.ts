const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/** The sizes TMDB serves; anything else answers 404. */
export const IMAGE_SIZES = [
  'w185',
  'w342',
  'w500',
  'w780',
  'w1280',
  'original',
] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

/** The full URL of a TMDB image at one size; null when the film has none. */
export const imageUrl = (path: string | null, size: ImageSize) =>
  path ? `${IMAGE_BASE_URL}/${size}${path}` : null;

/**
 * The images of a film as clients get them: a poster at two sizes (a list
 * thumbnail and a normal one) and a wide backdrop, each null when TMDB has none.
 */
export const filmImages = (paths: {
  posterPath: string | null;
  backdropPath: string | null;
}) => ({
  posterUrl: imageUrl(paths.posterPath, 'w342'),
  posterUrlSmall: imageUrl(paths.posterPath, 'w185'),
  backdropUrl: imageUrl(paths.backdropPath, 'w1280'),
});
