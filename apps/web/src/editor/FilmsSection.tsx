import { ROUTE_LIMITS } from '@film-routes/shared';
import { useId, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthorRouteDetail, AuthorStep } from '../api/types.js';
import { Icon } from '../components/Icon.js';
import { EmptyState } from '../components/States.js';
import { FilmList } from './FilmList.js';
import { filmsState } from './films.js';
import { contentOf, notesProgress } from './notes.js';
import type { useStepNotes } from './useStepNotes.js';

type Props = {
  route: AuthorRouteDetail;
  /** Whether the "Add a film" button is shown (it is not when the panel is). */
  showAdd: boolean;
  addRef: RefObject<HTMLButtonElement | null>;
  onOpenSearch: () => void;
  onReorder: (stepIds: string[]) => void;
  onRemove: (step: AuthorStep) => void;
  /** A refusal to reorder or remove, already translated. */
  error: string | null;
  /** The last thing that happened to the list, for people who cannot see it. */
  status: string;
  announce: (message: string) => void;
  /** The notes and emotion of every film, and how they are saved. */
  notes: ReturnType<typeof useStepNotes>;
  onPreview: (step: AuthorStep, trigger: HTMLButtonElement) => void;
};

/**
 * The films of the route: how many there are, what is missing, the list, and
 * the way to add more. When travelers have joined it says so and the list can
 * only be read.
 */
export function FilmsSection({
  route,
  showAdd,
  addRef,
  onOpenSearch,
  onReorder,
  onRemove,
  error,
  status,
  announce,
  notes,
  onPreview,
}: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const { count, canAdd, missing } = filmsState(route.steps.length);
  const { locked } = route;
  const progress = notesProgress(
    route.steps.map((step) => contentOf(step, notes.draft(step))),
  );

  return (
    <section className="editor-films" aria-labelledby={headingId}>
      <header className="films-head">
        <h2 id={headingId}>{t('editor.films.title')}</h2>
        <p className="films-count">
          {t('editor.films.count', { count, max: ROUTE_LIMITS.maxSteps })}
        </p>
      </header>

      {locked ? (
        <div className="route-notice editor-notice" role="note">
          <Icon name="lock" size={18} />
          <div>
            <strong>{t('editor.locked.title')}</strong>
            <p>{t('editor.locked.body')}</p>
          </div>
        </div>
      ) : (
        missing > 0 && (
          <p className="films-min">
            <Icon name="alert" size={16} />
            {t('editor.films.min', { min: ROUTE_LIMITS.minSteps })}
          </p>
        )
      )}

      {route.steps.length > 0 && (
        <div className="films-notes-summary">
          <p
            className="films-notes-count"
            data-complete={progress.done === progress.total}
          >
            <Icon
              name={progress.done === progress.total ? 'check' : 'pending'}
              size={16}
            />
            {t('editor.notes.summary', progress)}
          </p>
          <p className="hint">
            {t('editor.notes.summaryHint', {
              min: ROUTE_LIMITS.minSteps,
              max: ROUTE_LIMITS.maxSteps,
            })}
          </p>
        </div>
      )}

      {route.steps.length === 0 ? (
        <EmptyState
          strip
          title={t('editor.films.emptyTitle')}
          text={t('editor.films.emptyText')}
        />
      ) : (
        <div className="card card-pad">
          <FilmList
            steps={route.steps}
            locked={locked}
            onReorder={onReorder}
            onRemove={onRemove}
            announce={announce}
            notes={notes}
            onPreview={onPreview}
          />
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {status}
      </p>

      {/* Phones and tablets: pinned above the bottom bar. Gone at ten films. */}
      {showAdd && !locked && canAdd && (
        <div className="films-add-bar">
          <button
            type="button"
            ref={addRef}
            className={`btn btn-block ${count < ROUTE_LIMITS.minSteps ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onOpenSearch}
          >
            <Icon name="plus" size={18} />
            {t('editor.films.add')}
          </button>
        </div>
      )}
    </section>
  );
}
