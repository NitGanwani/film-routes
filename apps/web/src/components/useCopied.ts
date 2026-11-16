import { useEffect, useRef, useState } from 'react';
import { useToast } from './toast/useToast.js';

/** How long "Copied" stays on a button. */
const COPIED_MS = 2000;

/**
 * Copy a text to the clipboard and say so: "Copied" on the button for two
 * seconds and a notice. When the clipboard is not available (or refuses),
 * `onFail` runs so the text can be left selected for copying by hand, and the
 * notice offers to try again.
 */
export function useCopied(text: string, onFail?: () => void) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const toast = useToast();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
      toast.copied();
    } catch {
      onFail?.();
      toast.copyFailed(() => void copy());
    }
  }

  return { copied, copy };
}
