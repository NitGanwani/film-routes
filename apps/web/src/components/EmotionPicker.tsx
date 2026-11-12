import { EMOTIONS, type Emotion } from '@film-routes/shared';
import * as m from 'motion/react-m';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.js';

type Props = {
  /** Radios of one group share this name. */
  name: string;
  value: Emotion | null;
  onChange: (emotion: Emotion) => void;
  /** The id of what names the group (a legend or a label). */
  labelledBy: string;
  /**
   * An extra choice that means "none yet" and leaves the value null: for when
   * the answer is optional. Without it, nothing is picked until something is.
   */
  none?: { label: string; onChoose: () => void };
  describedBy?: string;
};

/**
 * One emotion out of the eight: native radios (the arrow keys move between
 * them, a screen reader says "3 of 8"), drawn as tiles. The chosen one shows by
 * border, tint AND a tick, and each has its icon AND its name: never colour alone.
 * The sheet that closes a film and the editor of a route share it.
 */
export function EmotionPicker({
  name,
  value,
  onChange,
  labelledBy,
  none,
  describedBy,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="emo-grid"
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {EMOTIONS.map((emotion) => (
        // The chosen tile swells a little under the finger.
        <m.label
          key={emotion}
          className="emo-opt emo"
          data-emo={emotion}
          whileTap={{ scale: 1.04 }}
          transition={{ duration: 0.12 }}
        >
          <input
            className="visually-hidden"
            type="radio"
            name={name}
            value={emotion}
            checked={value === emotion}
            onChange={() => onChange(emotion)}
          />
          <Icon name={emotion} size={26} />
          {t(`emotions.${emotion}`)}
        </m.label>
      ))}
      {none && (
        <label className="emo-opt emo-none">
          <input
            className="visually-hidden"
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={none.onChoose}
          />
          <Icon name="pending" size={20} />
          {none.label}
        </label>
      )}
    </div>
  );
}
