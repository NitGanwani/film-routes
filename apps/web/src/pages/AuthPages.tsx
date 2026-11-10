import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { errorMessage } from '../components/errorMessage.js';
import { safeNextPath } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';

/** Where to go once signed in: the page they came from, or the home page. */
function useNextPath() {
  const [params] = useSearchParams();
  return safeNextPath(params.get('next'));
}

/** Runs a submit, tracking "sending" and the error to show. */
function useSubmit(action: () => Promise<void>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const next = useNextPath();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await action();
      void navigate(next, { replace: true });
    } catch (failure) {
      setError(errorMessage(t, failure));
      setSending(false);
    }
  }
  return { sending, error, onSubmit };
}

export function LoginPage() {
  const { t } = useTranslation();
  const session = useSession();
  const location = useLocation();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const form = useSubmit(() => session.login({ email, password }));
  const next = useNextPath();

  if (session.status === 'authenticated') return <Navigate to={next} replace />;

  return (
    <div className="page narrow">
      <header className="auth-head">
        <h1>{t('auth.loginTitle')}</h1>
        <p>{t('auth.loginIntro')}</p>
      </header>
      <form
        className="auth-form"
        onSubmit={(event) => void form.onSubmit(event)}
      >
        <div className="field">
          <label htmlFor={`${id}-email`}>{t('auth.email')}</label>
          <input
            id={`${id}-email`}
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>{t('auth.password')}</label>
          <input
            id={`${id}-password`}
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {form.error && (
          <p className="form-error" role="alert">
            {form.error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={form.sending}
        >
          {form.sending ? t('auth.sending') : t('auth.submitLogin')}
        </button>
      </form>
      <p className="auth-switch">
        {t('auth.firstTime')}{' '}
        <Link to={`/register${location.search}`}>
          {t('auth.createAccount')}
        </Link>
      </p>
    </div>
  );
}

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const location = useLocation();
  const id = useId();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const form = useSubmit(() =>
    session.register({
      username,
      email,
      password,
      locale: i18n.language === 'en' ? 'en' : 'es',
    }),
  );
  const next = useNextPath();

  if (session.status === 'authenticated') return <Navigate to={next} replace />;

  return (
    <div className="page narrow">
      <header className="auth-head">
        <h1>{t('auth.registerTitle')}</h1>
        <p>{t('auth.registerIntro')}</p>
      </header>
      <form
        className="auth-form"
        onSubmit={(event) => void form.onSubmit(event)}
      >
        <div className="field">
          <label htmlFor={`${id}-username`}>{t('auth.username')}</label>
          <input
            id={`${id}-username`}
            className="input"
            autoComplete="username"
            required
            minLength={3}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-email`}>{t('auth.email')}</label>
          <input
            id={`${id}-email`}
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-password`}>{t('auth.password')}</label>
          <input
            id={`${id}-password`}
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            aria-describedby={`${id}-hint`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="hint" id={`${id}-hint`}>
            {t('auth.passwordHint')}
          </span>
        </div>
        {form.error && (
          <p className="form-error" role="alert">
            {form.error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={form.sending}
        >
          {form.sending ? t('auth.sending') : t('auth.submitRegister')}
        </button>
      </form>
      <p className="auth-switch">
        {t('auth.haveAccount')}{' '}
        <Link to={`/login${location.search}`}>{t('auth.enter')}</Link>
      </p>
    </div>
  );
}
