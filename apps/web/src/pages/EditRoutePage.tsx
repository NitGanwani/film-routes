import { ROUTE_LIMITS } from '@film-routes/shared';
import { AnimatePresence } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { useRouteFilms } from '../api/mutations.js';
import { useMyRoute } from '../api/queries.js';
import type {
  AuthorRouteDetail,
  AuthorStep,
  FilmSearchResult,
} from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { FieldFeedback } from '../components/FieldFeedback.js';
import { Icon } from '../components/Icon.js';
import { LanguageTag } from '../components/LanguageTag.js';
import { SaveStatus } from '../components/SaveStatus.js';
import { EmptyState, ErrorBox } from '../components/States.js';
import { useMediaQuery } from '../components/useMediaQuery.js';
import { FilmSearchPanel, FilmSearchSheet } from '../editor/FilmSearch.js';
import { FilmsSection } from '../editor/FilmsSection.js';
import { filmsState, isLockedRefusal, stepKey } from '../editor/films.js';
import { combineSaveState, previewStep } from '../editor/notes.js';
import { StepPreview } from '../editor/StepPreview.js';
import { useStepNotes } from '../editor/useStepNotes.js';
import { useSession } from '../session/SessionProvider.js';
import { filmTitle } from '../films/titles.js';
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
  const { t, i18n } = useTranslation();
  const id = useId();
  const save = useRouteAutosave(route);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(titleRef, save.title);
  useAutosize(descriptionRef, save.description);

  const titleIssue = titleProblem(save.title);
  const descriptionIssue = descriptionProblem(save.description);
  const { hidden, reason } = route.moderation;

  const films = useRouteFilms(route.id);
  const notes = useStepNotes(route.id, films.update);
  const { user } = useSession();
  // The film whose preview is open (by TMDB id), and the button that opened it.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const previewed = route.steps.find((step) => stepKey(step) === previewing);
  // The title, the description and every film's notes share one indicator.
  const saveState = combineSaveState(save.state, notes.state);
  const retryAll = () => {
    save.flush();
    notes.flushAll();
  };
  // A film that is taken out must not be saved back from its draft.
  const { forget } = notes;
  useEffect(() => forget(route.steps), [forget, route.steps]);
  // Wide screens have the search beside the list; the rest open it as a sheet.
  const wide = useMediaQuery('(min-width: 1100px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [status, setStatus] = useState('');
  const addRef = useRef<HTMLButtonElement>(null);
  const { canAdd } = filmsState(route.steps.length);
  const taken = useMemo(
    () => new Set(route.steps.map((step) => step.film.tmdbId)),
    [route.steps],
  );

  // A refusal because travelers have joined says what the strip above the list
  // says; anything else is told as the server explains it.
  const failure = (error: unknown) =>
    isLockedRefusal(error)
      ? `${t('editor.locked.title')}. ${t('editor.locked.body')}`
      : errorMessage(t, error);
  const addError =
    films.add.isError && !route.locked ? failure(films.add.error) : null;
  const listError = route.locked
    ? null
    : films.remove.isError
      ? failure(films.remove.error)
      : films.reorder.isError
        ? failure(films.reorder.error)
        : null;

  function addFilm(film: FilmSearchResult) {
    // A second click before the first has shown would only be refused.
    if (!canAdd || taken.has(film.tmdbId)) return;
    films.add.mutate(film);
    setStatus(
      t('editor.films.added', {
        title: film.title,
        count: route.steps.length + 1,
        max: ROUTE_LIMITS.maxSteps,
      }),
    );
  }

  function removeFilm(step: AuthorStep) {
    films.remove.mutate(step.id);
    setStatus(
      t('editor.films.removed', {
        title: filmTitle(step.film, i18n.language),
        count: route.steps.length - 1,
        max: ROUTE_LIMITS.maxSteps,
      }),
    );
  }

  return (
    <div className="page">
      <div
        className={
          wide && !route.locked ? 'editor-layout has-panel' : 'editor-layout'
        }
      >
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
            <SaveStatus state={saveState} onRetry={retryAll} />
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

          <FilmsSection
            route={route}
            showAdd={!wide}
            addRef={addRef}
            onOpenSearch={() => {
              films.add.reset();
              setSheetOpen(true);
            }}
            onReorder={(stepIds) => films.reorder.mutate(stepIds)}
            onRemove={removeFilm}
            error={listError}
            status={status}
            announce={setStatus}
            notes={notes}
            onPreview={(step, trigger) => {
              previewTrigger.current = trigger;
              setPreviewing(stepKey(step));
            }}
          />
        </div>

        {wide && !route.locked && (
          <FilmSearchPanel
            taken={taken}
            full={!canAdd}
            onAdd={addFilm}
            error={addError}
          />
        )}
      </div>

      {/* AnimatePresence keeps the sheet on screen while it slides away; the
          focus goes back to the button that opened it. */}
      <AnimatePresence onExitComplete={() => addRef.current?.focus()}>
        {sheetOpen && !wide && !route.locked && (
          <FilmSearchSheet
            taken={taken}
            full={!canAdd}
            onAdd={addFilm}
            error={addError}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* The film as the traveler meets it: the journey's own row, fed with
          what is written so far. The focus goes back to the button that opened it. */}
      <AnimatePresence onExitComplete={() => previewTrigger.current?.focus()}>
        {previewed && (
          <StepPreview
            key={stepKey(previewed)}
            step={previewStep(previewed, {
              noteBefore: notes.draft(previewed).noteBefore,
            })}
            author={user?.username ?? ''}
            onClose={() => setPreviewing(null)}
          />
        )}
      </AnimatePresence>
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
