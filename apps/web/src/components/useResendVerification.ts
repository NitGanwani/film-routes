import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { api } from '../api/instance.js';
import { useSession } from '../session/SessionProvider.js';
import { errorMessage } from './errorMessage.js';

/**
 * Asking for the confirmation email again: the one action behind the banner of
 * unconfirmed accounts and the "Resend" link of the share requirements.
 */
export function useResendVerification() {
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

  return { status, error, resend };
}
