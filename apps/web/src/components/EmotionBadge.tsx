import type { Emotion } from '@film-routes/shared';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.js';

/** An emotion is always shown with its icon AND its name, never by colour alone. */
export function EmotionBadge({
  emotion,
  state,
  shared = false,
}: {
  emotion: Emotion;
  /** For a picture of a choice: the picked one, and those left aside. */
  state?: 'chosen' | 'dimmed';
  /** In a comparison: this one is in both lists. Drawn with a tick and said in text. */
  shared?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span
      className="chip emo"
      data-emo={emotion}
      data-state={state}
      data-shared={shared || undefined}
    >
      <Icon name={emotion} size={16} />
      {t(`emotions.${emotion}`)}
      {shared && (
        <>
          <Icon name="check" size={14} />
          <span className="visually-hidden">{t('journey.inCommon')}</span>
        </>
      )}
    </span>
  );
}

/** One or two emotions, side by side; the shared ones are marked. */
export function EmotionBadges({
  emotions,
  shared = [],
}: {
  emotions: readonly Emotion[];
  shared?: readonly Emotion[];
}) {
  return (
    <span className="emo-badges">
      {emotions.map((emotion) => (
        <EmotionBadge
          key={emotion}
          emotion={emotion}
          shared={shared.includes(emotion)}
        />
      ))}
    </span>
  );
}
