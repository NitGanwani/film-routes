import type { RouteVisibility } from '@film-routes/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from './store.js';

/**
 * The notices of the app, with their words. Each one has a rule about when to
 * use it (see docs/design/brand): a change the page already shows by itself
 * (a film that leaves the list) needs none.
 */
export function useToast() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      /** The visibility of a route changed: nothing on the page says it twice. */
      visibilityChanged: (visibility: RouteVisibility) =>
        showToast({
          kind: 'changes',
          title: t('toast.changes'),
          detail: t(`toast.visibility.${visibility}`),
        }),
      /** A link is on the clipboard. */
      copied: () =>
        showToast({
          kind: 'copied',
          title: t('toast.copied'),
          detail: t('toast.copiedDetail'),
        }),
      /** The clipboard said no: the link is selected for copying by hand. */
      copyFailed: (retry: () => void) =>
        showToast({
          kind: 'error',
          title: t('toast.copyFailed'),
          detail: t('toast.copyFailedDetail'),
          action: { label: t('common.retry'), run: retry },
        }),
      /** An invitation was made; `copy` is what everybody does next. */
      inviteCreated: (detail: string, copy: () => void) =>
        showToast({
          kind: 'invite',
          title: t('toast.invite'),
          detail,
          action: { label: t('toast.inviteCopy'), run: copy },
        }),
    }),
    [t],
  );
}
