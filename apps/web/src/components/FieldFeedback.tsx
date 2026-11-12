import { useTranslation } from 'react-i18next';
import { counterLevel, measure, type Problem } from '../editor/model.js';

/**
 * Under a text field: what is wrong with it (read out as soon as it appears)
 * and, once it gets close to the limit, how many characters are left. The
 * counter is quiet until it matters: amber at the limit, red past it.
 */
export function FieldFeedback({
  id,
  problem,
  value,
  max,
}: {
  /** The id the field points to with aria-describedby (`${id}-error`). */
  id: string;
  problem: Problem | null;
  value: string;
  max: number;
}) {
  const { t } = useTranslation();
  const length = measure(value);
  const level = counterLevel(length, max);
  return (
    <div className="field-feedback">
      {problem && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {t(`editor.errors.${problem}`, { max })}
        </p>
      )}
      {level !== 'hidden' && (
        <span className="count" data-level={level}>
          {t('editor.counter', { count: length, max })}
        </span>
      )}
    </div>
  );
}
