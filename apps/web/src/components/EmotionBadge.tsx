import type { Emotion } from '@film-routes/shared';
import { useTranslation } from 'react-i18next';

/**
 * An emotion is always shown with its name, never by colour alone. The
 * `data-emotion` attribute is where the design will hang colour and icon.
 */
export function EmotionBadge({ emotion }: { emotion: Emotion }) {
  const { t } = useTranslation();
  return <span data-emotion={emotion}>{t(`emotions.${emotion}`)}</span>;
}
