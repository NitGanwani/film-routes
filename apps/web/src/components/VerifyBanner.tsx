import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.js';
import { useResendVerification } from './useResendVerification.js';

/** Shown to signed-in people whose email is not confirmed yet. */
export function VerifyBanner() {
  const { t } = useTranslation();
  const { status, error, resend } = useResendVerification();

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
