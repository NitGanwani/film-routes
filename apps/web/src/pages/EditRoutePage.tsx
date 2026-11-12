import { ROUTE_LIMITS } from '@film-routes/shared';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { useMyRoute } from '../api/queries.js';
import type { AuthorRouteDetail } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { FieldFeedback } from '../components/FieldFeedback.js';
import { Icon } from '../components/Icon.js';
import { LanguageTag } from '../components/LanguageTag.js';
import { SaveStatus } from '../components/SaveStatus.js';
import { EmptyState, ErrorBox } from '../components/States.js';
import { descriptionProblem, titleProblem } from '../editor/model.js';
import { useAutosize } from '../editor/useAutosize.js';
import { useRouteAutosave } from '../editor/useRouteAutosave.js';

/** The editor of one of my routes. Everything on it saves by itself. */
export function EditRoutePage() {
  const { t } = useTranslation();
  const { routeId = '' } = useParams();
  const route = useMyRoute(routeId);

  if (route.isPending) return <EditorSkeleton />;

  if (route.isError) {
    // Someone else's route answers 404, like one that is not there; an id that
    // is not even an id answers 400. Both read the same to the person.
    const missing =
      route.error instanceof ApiError &&
      (route.error.status === 404 || route.error.status === 400);
    return (
      <div className="page narrow">
        {missing ? (
          <EmptyState title={t('editor.notFound')}>
            <Link className="btn btn-secondary" to="/my-routes">
              {t('myRoutes.title')}
            </Link>
          </EmptyState>
        ) : (
          <ErrorBox
            message={errorMessage(t, route.error)}
            onRetry={() => void route.refetch()}
          />
        )}
      </div>
    );
  }

  // Keyed by id: another route is another editor, with its own text.
  return <RouteEditor key={route.data.id} route={route.data} />;
}

function RouteEditor({ route }: { route: AuthorRouteDetail }) {
  const { t } = useTranslation();
  const id = useId();
  const save = useRouteAutosave(route);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(titleRef, save.title);
  useAutosize(descriptionRef, save.description);

  const titleIssue = titleProblem(save.title);
  const descriptionIssue = descriptionProblem(save.description);
  const { hidden, reason } = route.moderation;

  return (
    <div className="page">
      <div className="editor">
        {hidden && (
          <div className="route-notice editor-notice" role="note">
            <Icon name="alert" size={18} />
            <div>
              <strong>{t('editor.hidden.title')}</strong>
              {reason && <p>{t('editor.hidden.reason', { reason })}</p>}
              <p>{t('editor.hidden.body')}</p>
            </div>
          </div>
        )}

        <div className="editor-top">
          <Link className="back-link" to="/my-routes">
            <Icon name="back" size={18} />
            {t('myRoutes.title')}
          </Link>
          <SaveStatus state={save.state} onRetry={save.flush} />
        </div>

        <h1 className="visually-hidden">{t('editor.heading')}</h1>

        <div className={titleIssue ? 'field invalid' : 'field'}>
          <label className="visually-hidden" htmlFor={`${id}-title`}>
            {t('editor.fields.title')}
          </label>
          {/* A textarea of one line that grows: a long title wraps instead of
              hiding behind an ellipsis. Enter confirms it, it never adds a line. */}
          <textarea
            id={`${id}-title`}
            ref={titleRef}
            className="title-input"
            rows={1}
            value={save.title}
            placeholder={t('editor.fields.titlePlaceholder')}
            aria-invalid={titleIssue !== null}
            aria-describedby={titleIssue ? `${id}-title-error` : undefined}
            onChange={(event) =>
              save.setTitle(event.target.value.replace(/\s*\n+\s*/g, ' '))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            onBlur={save.flush}
          />
          <FieldFeedback
            id={`${id}-title`}
            problem={titleIssue}
            value={save.title}
            max={ROUTE_LIMITS.titleMaxLength}
          />
        </div>

        <div className={descriptionIssue ? 'field invalid' : 'field'}>
          <label htmlFor={`${id}-description`}>
            {t('editor.fields.description')}
          </label>
          <textarea
            id={`${id}-description`}
            ref={descriptionRef}
            className="input autosize"
            rows={2}
            value={save.description}
            placeholder={t('editor.fields.descriptionPlaceholder')}
            aria-invalid={descriptionIssue !== null}
            aria-describedby={
              descriptionIssue ? `${id}-description-error` : undefined
            }
            onChange={(event) => save.setDescription(event.target.value)}
            onBlur={save.flush}
          />
          <FieldFeedback
            id={`${id}-description`}
            problem={descriptionIssue}
            value={save.description}
            max={ROUTE_LIMITS.descriptionMaxLength}
          />
        </div>

        {/* The API fixes the language when the route is created, so it is shown, not offered. */}
        <div className="field">
          <span className="field-label">{t('editor.fields.locale')}</span>
          <p className="locale-fixed">
            <LanguageTag locale={route.locale} />
            {t(`languages.${route.locale}`)}
          </p>
          <span className="hint">{t('editor.localeFixed')}</span>
        </div>

        <section className="editor-films" aria-labelledby={`${id}-films`}>
          <h2 id={`${id}-films`}>{t('editor.films.title')}</h2>
          <p className="editor-films-count">
            {t('editor.films.count', {
              count: route.steps.length,
              max: ROUTE_LIMITS.maxSteps,
            })}
          </p>
        </section>
      </div>
    </div>
  );
}

/** The shape of the editor while it loads, so the page does not jump. */
function EditorSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="page" aria-busy="true">
      <div className="editor" aria-hidden="true">
        <div className="skel line" style={{ width: '90px' }} />
        <div className="skel" style={{ height: '48px', width: '80%' }} />
        <div className="skel" style={{ height: '72px' }} />
        <div className="skel line" style={{ width: '40%' }} />
      </div>
      <p className="visually-hidden" role="status">
        {t('common.loading')}
      </p>
    </div>
  );
}
