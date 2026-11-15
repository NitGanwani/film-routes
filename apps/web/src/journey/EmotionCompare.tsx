import type { Emotion } from '@film-routes/shared';
import * as m from 'motion/react-m';
import type { HTMLMotionProps } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { EmotionBadge } from '../components/EmotionBadge.js';

/** One side of the comparison: who it is and what they felt. */
export type CompareSide = {
  /** Already translated: "You", the guide's name, "Me"… */
  label: string;
  emotion: Emotion | null;
  /** What to say when there is no emotion; without it the side is not drawn. */
  empty?: string;
};

type Reveal = Pick<
  HTMLMotionProps<'div'>,
  'initial' | 'animate' | 'transition'
>;

/**
 * Two emotions side by side with "same" or "different" between them: the
 * traveler sees it as "You / the guide", the guide as "Me / the traveler". The
 * labels are given, so the row is the same for both points of view. The chip
 * only appears when both sides have an emotion.
 */
export function EmotionCompare({
  left,
  right,
  comparison,
  reveal = {},
  className = '',
}: {
  left: CompareSide;
  right: CompareSide;
  comparison: 'same' | 'different' | null;
  /** A soft entrance for what has just opened (the chip and the right side). */
  reveal?: Reveal;
  className?: string;
}) {
  const { t } = useTranslation();
  const side = (item: CompareSide) => (
    <>
      <span className="who">{item.label}</span>
      {item.emotion ? (
        <EmotionBadge emotion={item.emotion} />
      ) : (
        <span className="compare-empty">{item.empty}</span>
      )}
    </>
  );
  const hasLeft = left.emotion !== null || left.empty !== undefined;
  const hasRight = right.emotion !== null || right.empty !== undefined;

  return (
    <div className={`compare ${className}`.trim()}>
      {hasLeft && <div>{side(left)}</div>}
      {comparison && (
        <m.span
          className={`vs${comparison === 'same' ? ' same' : ''}`}
          {...reveal}
        >
          {t(`journey.${comparison}`)}
        </m.span>
      )}
      {hasRight && <m.div {...reveal}>{side(right)}</m.div>}
    </div>
  );
}
