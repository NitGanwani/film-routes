import { ROUTE_LIMITS, type Locale } from '@film-routes/shared';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCreateRoute } from '../api/mutations.js';
import { errorMessage } from '../components/errorMessage.js';
import { FieldFeedback } from '../components/FieldFeedback.js';
import { Icon } from '../components/Icon.js';
import { LocaleSegmented } from '../components/LocaleSegmented.js';
import { titleProblem } from '../editor/model.js';

/**
 * Starting a route asks for the two things that cannot wait: a title and the
 * language it is written in. Everything else is filled in the editor, which
 * saves by itself.
 */
export function NewRoutePage() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const create = useCreateRoute();
  const [title, setTitle] = useState('');
  // The language of the page is the best guess for the language of the notes.
  const [locale, setLocale] = useState<Locale>(
    i18n.language === 'en' ? 'en' : 'es',
  );
  const [attempted, setAttempted] = useState(false);

  const problem = titleProblem(title);
  // An empty title is only a problem once they try to go on.
  const shown = problem === 'required' && !attempted ? null : problem;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (problem) return;
    create.mutate({ title: title.trim(), locale });
  }

  return (
    <div className="page narrow">
      <Link className="back-link" to="/my-routes">
        <Icon name="back" size={18} />
        {t('myRoutes.title')}
      </Link>
      <h1 className="editor-new-title">{t('editor.new.title')}</h1>
      <form className="auth-form editor-new" onSubmit={onSubmit} noValidate>
        <div className={shown ? 'field invalid' : 'field'}>
          <label htmlFor={`${id}-title`}>{t('editor.fields.title')}</label>
          <input
            id={`${id}-title`}
            className="input"
            value={title}
            placeholder={t('editor.fields.titlePlaceholder')}
            aria-invalid={shown !== null}
            aria-describedby={shown ? `${id}-title-error` : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldFeedback
            id={`${id}-title`}
            problem={shown}
            value={title}
            max={ROUTE_LIMITS.titleMaxLength}
          />
        </div>
        <fieldset className="field">
          <legend>{t('editor.fields.locale')}</legend>
          <LocaleSegmented
            name={`${id}-locale`}
            value={locale}
            onChange={setLocale}
          />
          <span className="hint">{t('editor.localeHint')}</span>
        </fieldset>
        {create.isError && (
          <p className="form-error" role="alert">
            {errorMessage(t, create.error)}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={create.isPending}
        >
          {create.isPending ? t('editor.creating') : t('editor.create')}
        </button>
      </form>
    </div>
  );
}
