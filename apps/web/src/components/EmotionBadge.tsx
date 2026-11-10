import type { Emotion } from '@film-routes/shared';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.js';

/** An emotion is always shown with its icon AND its name, never by colour alone. */
export function EmotionBadge({ emotion }: { emotion: Emotion }) {
  const { t } = useTranslation();
  return (
    <span className="chip emo" data-emo={emotion}>
      <Icon name={emotion} size={16} />
      {t(`emotions.${emotion}`)}
    </span>
  );
}
