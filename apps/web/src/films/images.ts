/**
 * The two widths a backdrop is offered at. TMDB serves every image at fixed
 * widths and the API sends the biggest one (w1280); the smaller one is the same
 * path under another size, so the browser can pick: w780 is plenty on a phone.
 */
export function backdropSources(url: string): {
  src: string;
  srcSet: string | undefined;
} {
  const small = url.replace('/w1280/', '/w780/');
  // An address in some other shape: use it as it is rather than guess.
  if (small === url) return { src: url, srcSet: undefined };
  return { src: url, srcSet: `${small} 780w, ${url} 1280w` };
}
