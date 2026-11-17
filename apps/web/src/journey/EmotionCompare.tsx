import type { Emotion } from '@film-routes/shared';
import * as m from 'motion/react-m';
import type { HTMLMotionProps } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { EmotionBadges } from '../components/EmotionBadge.js';
import { Icon } from '../components/Icon.js';
import type { Comparison } from './model.js';

/** One side of the comparison: who it is and what they felt (one or two). */
export type CompareSide = {
  /** Already translated: "You", the guide's name, "Me"… */
  label: string;
  emotions: readonly Emotion[];
  /** What to say when there is no emotion; without it the side is not drawn. */
  empty?: string;
};

type Reveal = Pick<
  HTMLMotionProps<'div'>,
  'initial' | 'animate' | 'transition'
>;

/**
 * Two lists of emotions side by side with "you match" or "different" between
 * them: the traveler sees it as "You / the guide", the guide as "Me / the
 * traveler". The labels are given, so the row is the same for both points of
 * view. The chip only appears when both sides have an emotion, and the
 * emotions they share carry a tick (and a hidden "in common" for a screen reader).
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
  comparison: Comparison | null;
  /** A soft entrance for what has just opened (the chip and the right side). */
  reveal?: Reveal;
  className?: string;
}) {
  const { t } = useTranslation();
  const shared = comparison?.shared ?? [];
  const side = (item: CompareSide) => (
    <>
      <span className="who">{item.label}</span>
      {item.emotions.length > 0 ? (
        <EmotionBadges emotions={item.emotions} shared={shared} />
      ) : (
        <span className="compare-empty">{item.empty}</span>
      )}
    </>
  );
  const hasLeft = left.emotions.length > 0 || left.empty !== undefined;
  const hasRight = right.emotions.length > 0 || right.empty !== undefined;

  return (
    <div className={`compare ${className}`.trim()}>
      {hasLeft && <div>{side(left)}</div>}
      {comparison && (
        <m.span
          className={`vs${comparison.result === 'same' ? ' same' : ''}`}
          {...reveal}
        >
          {comparison.result === 'same' && <Icon name="check" size={12} />}
          {t(`journey.${comparison.result}`)}
        </m.span>
      )}
      {hasRight && <m.div {...reveal}>{side(right)}</m.div>}
    </div>
  );
}
