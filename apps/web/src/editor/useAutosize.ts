import { useLayoutEffect, type RefObject } from 'react';

/** A textarea that grows with what is written in it, so there is never a scrollbar inside. */
export function useAutosize(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    // scrollHeight leaves out the borders, which the box-sizing counts.
    const borders = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + borders}px`;
  }, [ref, value]);
}
