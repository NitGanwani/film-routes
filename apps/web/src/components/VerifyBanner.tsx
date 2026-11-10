import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { api } from '../api/instance.js';
import { useSession } from '../session/SessionProvider.js';
import { errorMessage } from './errorMessage.js';
import { Icon } from './Icon.js';

/** Shown to signed-in people whose email is not confirmed yet. */
export function VerifyBanner() {
  const { t } = useTranslation();
  const { reloadUser } = useSession();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setStatus('sending');
    setError(null);
    try {
      await api.request('/auth/verify-email/resend', {
        method: 'POST',
        auth: true,
      });
      setStatus('sent');
    } catch (failure) {
      // Confirmed in another tab or device: the notice is out of date.
      if (failure instanceof ApiError && failure.code === 'already_verified') {
        void reloadUser();
      }
      setError(errorMessage(t, failure));
      setStatus('idle');
    }
  }

  return (
    <div className="verify-wrap">
      <div className="banner banner-warning">
        <Icon name="alert" />
        <div>
          <p>{t('banner.unverified')}</p>
          {status === 'sent' && (
            <p role="status">
              <b>{t('banner.sent')}</b>
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {status !== 'sent' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={status === 'sending'}
              onClick={() => void resend()}
            >
              {status === 'sending' ? t('banner.sending') : t('banner.resend')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
