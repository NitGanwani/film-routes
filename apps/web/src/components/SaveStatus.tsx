import { useTranslation } from 'react-i18next';
import type { SaveState } from '../editor/useRouteAutosave.js';
import { Icon } from './Icon.js';

/**
 * Whether what was typed is safe: always there, three states, no toasts.
 * "Saved" is the quiet default; a failure says so in words and offers to try
 * again. A change of state fades in (the CSS drops it with reduced motion).
 */
export function SaveStatus({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <p className="save-status" data-state={state} role="status">
      {/* The key makes the text a new element on each change, so it fades in. */}
      <span key={state} className="save-status-text">
        {state === 'saved' && (
          <>
            <Icon name="check" size={14} />
            {t('editor.saved')}
          </>
        )}
        {state === 'saving' && t('editor.saving')}
        {state === 'failed' && (
          <>
            <Icon name="alert" size={14} />
            {t('editor.saveFailed')} ·
            <button type="button" onClick={onRetry}>
              {t('editor.retry')}
            </button>
          </>
        )}
      </span>
    </p>
  );
}
