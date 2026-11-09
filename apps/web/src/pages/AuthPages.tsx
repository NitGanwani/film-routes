import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { errorMessage } from '../components/errorMessage.js';
import { useSession } from '../session/SessionProvider.js';

/** Runs a submit, tracking "sending" and the error to show. */
function useSubmit(action: () => Promise<void>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await action();
      void navigate('/');
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const form = useSubmit(() => session.login({ email, password }));

  if (session.status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <form onSubmit={(event) => void form.onSubmit(event)}>
      <h1>{t('auth.loginTitle')}</h1>
      <label>
        {t('auth.email')}
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        {t('auth.password')}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {form.error && <p role="alert">{form.error}</p>}
      <button type="submit" disabled={form.sending}>
        {form.sending ? t('auth.sending') : t('auth.submitLogin')}
      </button>
    </form>
  );
}

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const session = useSession();
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

  if (session.status === 'authenticated') return <Navigate to="/" replace />;

  return (
    <form onSubmit={(event) => void form.onSubmit(event)}>
      <h1>{t('auth.registerTitle')}</h1>
      <label>
        {t('auth.username')}
        <input
          autoComplete="username"
          required
          minLength={3}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label>
        {t('auth.email')}
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        {t('auth.password')}
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {form.error && <p role="alert">{form.error}</p>}
      <button type="submit" disabled={form.sending}>
        {form.sending ? t('auth.sending') : t('auth.submitRegister')}
      </button>
    </form>
  );
}
