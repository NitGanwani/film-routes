import type { RouteVisibility } from '@film-routes/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../errorMessage.js';
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
      /** A report was sent: the sheet closes, so this is the only answer. */
      reported: () =>
        showToast({
          kind: 'changes',
          title: t('toast.reported'),
          detail: t('toast.reportedDetail'),
        }),
      /** A link is on the clipboard. */
      copied: () =>
        showToast({
          kind: 'copied',
          title: t('toast.copied'),
          detail: t('toast.copiedDetail'),
        }),
      /** The vote did not save: the strip keeps the value, this offers to try again. */
      ratingFailed: (error: unknown, retry: () => void) =>
        showToast({
          kind: 'error',
          title: t('toast.ratingFailed'),
          detail: errorMessage(t, error),
          action: { label: t('toast.retry'), run: retry },
        }),
      /** A text (not a link) is on the clipboard. */
      textCopied: () =>
        showToast({
          kind: 'copied',
          title: t('toast.textCopied'),
          detail: t('toast.textCopiedDetail'),
        }),
      /** The clipboard said no for a text: it cannot be selected for them. */
      textCopyFailed: (retry: () => void) =>
        showToast({
          kind: 'error',
          title: t('toast.copyFailed'),
          detail: t('toast.textCopyFailedDetail'),
          action: { label: t('toast.retry'), run: retry },
        }),
      /** The clipboard said no: the link is selected for copying by hand. */
      copyFailed: (retry: () => void) =>
        showToast({
          kind: 'error',
          title: t('toast.copyFailed'),
          detail: t('toast.copyFailedDetail'),
          action: { label: t('toast.retry'), run: retry },
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
