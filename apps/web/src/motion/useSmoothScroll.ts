import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from './reducedMotion.js';

/**
 * Smooth scrolling for the wheel and the trackpad (Lenis). It is still the
 * page's normal scroll underneath: the keyboard, the scrollbar, touch and
 * anchors keep working. Off for people who ask for less motion, and paused
 * while a dialog is open (the page behind it must not move). Returns the
 * instance, null while there is none, so a page change can jump to the top.
 */
export function useSmoothScroll(): RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ autoRaf: true });
    lenisRef.current = lenis;

    // A modal <dialog> locks the page behind it: let Lenis let go of the wheel,
    // so the dialog's own content can scroll and the page does not.
    const syncWithDialog = () => {
      if (document.querySelector('dialog[open]')) lenis.stop();
      else lenis.start();
    };
    const observer = new MutationObserver(syncWithDialog);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    });

    return () => {
      observer.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}
