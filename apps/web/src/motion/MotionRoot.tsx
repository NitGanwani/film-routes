import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Where the app's animations are set up. The library's features load after the
 * first paint, so the page does not wait for them, and `strict` makes anything
 * that uses the heavy `motion.*` components (instead of the light `m.*`) fail
 * loudly. `reducedMotion="user"` turns movement off for anyone who asked their
 * system for less of it (fades stay, since they do not move anything).
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion
      features={() => import('./features.js').then((m) => m.default)}
      strict
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
