import { RATING } from '@film-routes/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useRateRoute } from '../api/mutations.js';
import { ratingQuery } from '../api/queries.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';

const SCORES = Array.from(
  { length: RATING.max - RATING.min + 1 },
  (_, index) => RATING.min + index,
);

/**
 * "How was the journey? 1 to 10": ten buttons of 44 px. Pressing one saves it;
 * pressing another changes it (one vote per person). The vote that stands is
 * said in words, so it is never only the colour of a button.
 */
export function RatingPicker({
  routeId,
  onRated,
}: {
  routeId: string;
  /** Whether a vote stands (so a dialog can say "Close" instead of "Later"). */
  onRated?: (voted: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const mine = useQuery(ratingQuery(routeId));
  const rate = useRateRoute(routeId);
  const score = rate.data?.rating.score ?? mine.data?.rating?.score ?? null;
  const voted = score !== null;
  useEffect(() => onRated?.(voted), [voted, onRated]);

  return (
    <div className="rating">
      <p id={`${id}-prompt`} className="rating-prompt">
        {t('rating.prompt', { min: RATING.min, max: RATING.max })}
      </p>
      <div
        role="group"
        aria-labelledby={`${id}-prompt`}
        className="rating-nums"
      >
        {SCORES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={score === value}
            aria-label={t('rating.score', { score: value, max: RATING.max })}
            disabled={rate.isPending}
            onClick={() => {
              if (value !== score) rate.mutate(value);
            }}
          >
            {value}
          </button>
        ))}
      </div>
      {rate.isError ? (
        <p className="form-error" role="alert">
          {errorMessage(t, rate.error)}
        </p>
      ) : (
        <p className="rating-status" role="status">
          {score !== null && (
            <>
              <Icon name="check" size={16} />
              {t('rating.yours', { score, max: RATING.max })}
            </>
          )}
        </p>
      )}
    </div>
  );
}
