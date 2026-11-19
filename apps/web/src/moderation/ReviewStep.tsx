import { useTranslation } from 'react-i18next';
import type { AuthorStep } from '../api/types.js';
import { EmotionBadges } from '../components/EmotionBadge.js';

/**
 * One film of a reported route as a moderator reads it: the public synopsis
 * AND the note that only opens when a traveler closes the film. A spoiler
 * report cannot be judged without the second one.
 */
export function ReviewStep({ step }: { step: AuthorStep }) {
  const { t } = useTranslation();
  const { film } = step;
  return (
    <li className="review-step">
      <span className="review-num">{step.position}</span>
      {film.posterUrlSmall ? (
        <img
          className="review-poster"
          src={film.posterUrlSmall}
          alt=""
          width={56}
          height={84}
          loading="lazy"
        />
      ) : (
        <span className="review-poster" aria-hidden="true" />
      )}
      <div className="review-body">
        <h3>
          {film.title}
          {film.releaseYear !== null && (
            <span className="review-year"> {film.releaseYear}</span>
          )}
        </h3>
        <dl className="review-notes">
          <div>
            <dt>{t('admin.review.synopsis')}</dt>
            <dd>{step.noteBefore ?? t('admin.review.noNote')}</dd>
          </div>
          <div>
            <dt>{t('admin.review.after')}</dt>
            <dd>{step.noteAfter ?? t('admin.review.noNote')}</dd>
          </div>
        </dl>
        {step.authorEmotions.length > 0 && (
          <EmotionBadges emotions={step.authorEmotions} />
        )}
      </div>
    </li>
  );
}
