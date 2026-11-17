import { EMOTIONS, MAX_EMOTIONS, type Emotion } from '@film-routes/shared';
import * as m from 'motion/react-m';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.js';
import { isFull, toggleEmotion } from './emotionPick.js';

type Props = {
  /** The checkboxes of one group share this name. */
  name: string;
  /** The chosen ones, at most two, in the order they were tapped. */
  value: readonly Emotion[];
  onChange: (emotions: Emotion[]) => void;
  /** The id of what names the group (a legend or a label). */
  labelledBy: string;
  /**
   * An extra choice that means "none yet" and clears the list: for when the
   * answer is optional. Without it, nothing is picked until something is.
   */
  none?: { label: string };
  describedBy?: string;
};

/**
 * Up to two emotions out of the eight: native checkboxes (the keyboard and a
 * screen reader work for free), drawn as tiles. A chosen one shows by border,
 * tint AND a tick, and each has its icon AND its name: never colour alone.
 * With two chosen the rest are disabled and a line of text says why, so the
 * limit is never a tile that silently does nothing.
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
  const full = isFull(value);
  return (
    <div className="emo-picker">
      <div
        className="emo-grid"
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {EMOTIONS.map((emotion) => {
          const checked = value.includes(emotion);
          return (
            // The tile swells a little under the finger.
            <m.label
              key={emotion}
              className="emo-opt emo"
              data-emo={emotion}
              // whileTap would make every tile a tab stop of its own (Motion
              // adds tabindex 0), and the focus would sit on the label. The
              // checkbox inside is what takes the focus.
              tabIndex={-1}
              whileTap={full && !checked ? undefined : { scale: 1.04 }}
              transition={{ duration: 0.12 }}
            >
              <input
                className="visually-hidden"
                type="checkbox"
                name={name}
                value={emotion}
                checked={checked}
                disabled={full && !checked}
                onChange={() => onChange(toggleEmotion(value, emotion))}
              />
              <Icon name={emotion} size={26} />
              {t(`emotions.${emotion}`)}
            </m.label>
          );
        })}
        {none && (
          <button
            type="button"
            className="emo-opt emo-none"
            aria-pressed={value.length === 0}
            onClick={() => onChange([])}
          >
            <Icon name="pending" size={20} />
            {none.label}
          </button>
        )}
      </div>
      {/* Always in the page, so a screen reader hears it when it fills. */}
      <p className="emo-limit" role="status">
        {full ? t('emotionPicker.limit', { max: MAX_EMOTIONS }) : ''}
      </p>
    </div>
  );
}
