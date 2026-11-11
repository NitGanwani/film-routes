import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Registered once, when this module is first loaded (with the landing page).
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** True when the person asked their system for less motion: then nothing is animated. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
