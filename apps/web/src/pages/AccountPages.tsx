import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/instance.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { useSession } from '../session/SessionProvider.js';

/** Where the email's "confirm" link lands: spends the token, says what happened. */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const session = useSession();
  const { reloadUser } = session;
  const token = useSearchParams()[0].get('token');
  // The link works once. In development React runs effects twice, so the
  // request is guarded: a second one would burn the link and show a false error.
  const started = useRef(false);
  const [state, setState] = useState<'working' | 'done' | 'failed'>(
    token ? 'working' : 'failed',
  );
  const [error, setError] = useState<string | null>(
    token ? null : t('errors.invalid_token'),
  );

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .request('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => {
        setState('done');
        void reloadUser();
      })
      .catch((failure: unknown) => {
        setError(errorMessage(t, failure));
        setState('failed');
      });
  }, [token, reloadUser, t]);

  return (
    <div className="page narrow">
      {state === 'working' && (
        <p className="note" role="status">
          {t('verify.working')}
        </p>
      )}
      {state === 'done' && (
        <div className="banner banner-success" role="status">
          <Icon name="check" />
          <div>
            <b>{t('verify.doneTitle')}</b>
            <p>{t('verify.doneText')}</p>
          </div>
        </div>
      )}
      {state === 'failed' && (
        <div className="error-box" role="alert">
          <h1>{t('verify.failedTitle')}</h1>
          <p>{error}</p>
          <p className="note">
            {session.status === 'authenticated' && session.user.emailVerified
              ? t('verify.alreadyConfirmed')
              : t('verify.failedHelp')}
          </p>
        </div>
      )}
      {state !== 'working' && (
        <p style={{ marginTop: 'var(--sp-5)' }}>
          {session.status === 'anonymous' ? (
            <Link className="btn btn-primary" to="/login">
              {t('verify.toLogin')}
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/explore">
              {t('verify.toExplore')}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

/** Asks for the recovery email. It answers the same whether the account exists or not. */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const id = useId();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.request('/auth/password/forgot', {
        method: 'POST',
        body: { email },
      });
      setSent(true);
    } catch (failure) {
      setError(errorMessage(t, failure));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page narrow">
      <header className="auth-head">
        <h1>{t('auth.forgotTitle')}</h1>
        <p>{t('auth.forgotIntro')}</p>
      </header>
      {sent ? (
        <div className="banner banner-success" role="status">
          <Icon name="check" />
          <div>{t('auth.forgotSent')}</div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={sending}
          >
            {sending ? t('auth.sending') : t('auth.sendLink')}
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </p>
    </div>
  );
}

/** Where the email's "reset" link lands: choose a new password. */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { logout } = useSession();
  const id = useId();
  const token = useSearchParams()[0].get('token');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.request('/auth/password/reset', {
        method: 'POST',
        body: { token, password },
      });
      setDone(true);
      // The server just signed this account out everywhere; do the same here.
      void logout();
    } catch (failure) {
      setError(errorMessage(t, failure));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="page narrow">
        <div className="banner banner-success" role="status">
          <Icon name="check" />
          <div>{t('auth.resetDone')}</div>
        </div>
        <p style={{ marginTop: 'var(--sp-5)' }}>
          <Link className="btn btn-primary" to="/login">
            {t('nav.login')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <header className="auth-head">
        <h1>{t('auth.resetTitle')}</h1>
        <p>{t('auth.resetIntro')}</p>
      </header>
      {!token ? (
        <div className="error-box" role="alert">
          <p>{t('errors.invalid_token')}</p>
          <p>
            <Link to="/forgot-password">{t('auth.requestNewLink')}</Link>
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <div className="field">
            <label htmlFor={`${id}-password`}>{t('auth.newPassword')}</label>
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
          {error && (
            <p className="form-error" role="alert">
              {error}
              {error === t('errors.invalid_token') && (
                <>
                  {' '}
                  <Link to="/forgot-password">{t('auth.requestNewLink')}</Link>
                </>
              )}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={sending}
          >
            {sending ? t('auth.sending') : t('auth.resetSubmit')}
          </button>
        </form>
      )}
    </div>
  );
}
