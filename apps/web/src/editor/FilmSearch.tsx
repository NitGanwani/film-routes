import { ROUTE_LIMITS } from '@film-routes/shared';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, type RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilmSearch } from '../api/queries.js';
import type { FilmSearchResult } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { Poster } from '../components/Poster.js';
import { originalTitleNote } from '../films/titles.js';
import { SEARCH_MAX_LENGTH, searchTerm } from './films.js';

/** How the sheet moves: the same as the one that closes a film. */
const SHEET_TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

type BodyProps = {
  /** The films already in the route, by TMDB id. */
  taken: ReadonlySet<number>;
  /** The ten are in: nothing more can be added. */
  full: boolean;
  onAdd: (film: FilmSearchResult) => void;
  /** A refusal to add, already translated. */
  error: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
};

/**
 * The search itself: a field, and under it the films that match. It lives in a
 * sheet on a phone and in a side panel on a wide screen; this is what both show.
 */
function SearchBody({ taken, full, onAdd, error, inputRef }: BodyProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const locale = i18n.language === 'en' ? 'en' : 'es';
  const [text, setText] = useState('');
  const { query, waiting } = useFilmSearch(text, locale);
  const typed = searchTerm(text);
  const results = query.data?.results ?? [];

  let content;
  if (typed === null) {
    // Nothing to search yet: say how to begin (one letter is still too little).
    content = (
      <p className="search-note">
        {text.trim()
          ? t('editor.films.search.short')
          : t('editor.films.search.empty')}
      </p>
    );
  } else if (waiting) {
    content = (
      <div aria-busy="true">
        <ul className="film-results" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="film-result">
              <span className="skel film-result-poster" />
              <span className="skel-block film-result-text">
                <span className="skel title" />
                <span className="skel line" style={{ width: '40%' }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="visually-hidden" role="status">
          {t('common.loading')}
        </p>
      </div>
    );
  } else if (query.isError) {
    content = (
      <div className="search-note" role="alert">
        <p>{errorMessage(t, query.error)}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void query.refetch()}
        >
          {t('common.retry')}
        </button>
      </div>
    );
  } else if (results.length === 0) {
    content = <p className="search-note">{t('editor.films.search.none')}</p>;
  } else {
    content = (
      <ul className="film-results">
        {results.map((film) => {
          const inRoute = taken.has(film.tmdbId);
          const original = originalTitleNote(film, film.title);
          return (
            <li key={film.tmdbId} className="film-result">
              <Poster url={film.posterUrlSmall ?? film.posterUrl} />
              <div className="film-result-text">
                <span className="film-result-title">
                  {film.title}
                  {film.releaseYear !== null && (
                    <>
                      {' '}
                      <span className="year">{film.releaseYear}</span>
                    </>
                  )}
                </span>
                {original && <span className="orig">{original}</span>}
              </div>
              {inRoute ? (
                <button type="button" className="btn btn-ghost" disabled>
                  <Icon name="check" size={18} />
                  {t('editor.films.inRoute')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={full}
                  onClick={() => onAdd(film)}
                >
                  {t('editor.films.addShort')}
                  <span className="visually-hidden"> {film.title}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="film-search">
      <div className="search-field">
        <label className="visually-hidden" htmlFor={`${id}-q`}>
          {t('editor.films.search.label')}
        </label>
        <Icon name="search" size={18} />
        <input
          id={`${id}-q`}
          ref={inputRef}
          className="input"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={SEARCH_MAX_LENGTH}
          value={text}
          placeholder={t('editor.films.search.placeholder')}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {full && (
        <p className="search-limit" role="status">
          <Icon name="info" size={18} />
          {t('editor.films.search.limit', { max: ROUTE_LIMITS.maxSteps })}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="film-search-results">{content}</div>
    </div>
  );
}

/** Wide screens: always there, beside the list. No dialog, nothing to open. */
export function FilmSearchPanel(props: Omit<BodyProps, 'inputRef'>) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <aside className="film-search-panel" aria-labelledby={titleId}>
      <h2 id={titleId}>{t('editor.films.search.title')}</h2>
      <SearchBody {...props} />
    </aside>
  );
}

type SheetProps = Omit<BodyProps, 'inputRef'> & { onClose: () => void };

/**
 * Phones and tablets: a sheet from the bottom, a native <dialog> like the one
 * that closes a film. Adding a film does not close it (several can be added in
 * a row); "Done" does.
 */
export function FilmSearchSheet({ onClose, ...body }: SheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice, and opening an open
    // dialog throws.
    if (dialog && !dialog.open) dialog.showModal();
    // Ready to type: that is the reason for opening the sheet.
    inputRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: close through our own state so the page and the dialog agree.
        event.preventDefault();
        onClose();
      }}
    >
      <m.div
        className="sheet-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SHEET_TRANSITION}
      />
      <m.div
        className="sheet-panel film-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SHEET_TRANSITION}
      >
        <div className="film-sheet-head">
          <div className="grab" aria-hidden="true" />
          <div className="film-sheet-bar">
            <h2 id={titleId}>{t('editor.films.search.title')}</h2>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('editor.films.done')}
            </button>
          </div>
        </div>
        <SearchBody {...body} inputRef={inputRef} />
      </m.div>
    </dialog>
  );
}
