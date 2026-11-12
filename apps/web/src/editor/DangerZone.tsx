import { AnimatePresence } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useChangeVisibility, useDeleteRoute } from '../api/mutations.js';
import { myRouteQuery } from '../api/queries.js';
import type { AuthorRouteDetail } from '../api/types.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { isLockedRefusal } from './films.js';
import { deleteNeedsTitle, titleMatches } from './share.js';

/**
 * "Danger": deleting the route, far from everything else and behind a border.
 * With travelers inside it cannot be deleted; the way out is to make it
 * private, so nobody new can join.
 */
export function DangerZone({ route }: { route: AuthorRouteDetail }) {
  const { t } = useTranslation();
  const headingId = useId();
  const queryClient = useQueryClient();
  const remove = useDeleteRoute(route.id, route.title);
  const makePrivate = useChangeVisibility(route.id);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const needsTitle = deleteNeedsTitle(route.steps.length);

  function close() {
    setOpen(false);
    setTyped('');
    remove.reset();
  }

  function confirm() {
    remove.mutate(undefined, {
      onError: (error) => {
        // Somebody joined after this page loaded: the route is locked now, and
        // the page must say so instead of offering the button again.
        if (isLockedRefusal(error)) {
          void queryClient.invalidateQueries({
            queryKey: myRouteQuery(route.id).queryKey,
          });
        }
      },
    });
  }

  return (
    <section className="editor-danger" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('danger.title')}</h2>

      {route.locked ? (
        <div className="danger-locked">
          <p>
            <Icon name="lock" size={16} />
            {t('danger.lockedBody')}
          </p>
          {route.visibility !== 'private' && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={makePrivate.isPending}
              onClick={() => makePrivate.mutate('private')}
            >
              {t('danger.makePrivate')}
            </button>
          )}
          {makePrivate.isError && (
            <p className="form-error" role="alert">
              {errorMessage(t, makePrivate.error)}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          ref={trigger}
          className="btn btn-danger"
          onClick={() => setOpen(true)}
        >
          <Icon name="trash" size={18} />
          {t('danger.delete')}
        </button>
      )}

      <AnimatePresence onExitComplete={() => trigger.current?.focus()}>
        {open && !route.locked && (
          <ConfirmDialog
            danger
            title={t('danger.confirm.title', { title: route.title })}
            body={t('danger.confirm.body')}
            confirmLabel={t('danger.confirm.ok')}
            cancelLabel={t('danger.confirm.cancel')}
            pending={remove.isPending}
            error={
              remove.isError
                ? isLockedRefusal(remove.error)
                  ? t('danger.lockedBody')
                  : errorMessage(t, remove.error)
                : null
            }
            typeToConfirm={
              needsTitle
                ? {
                    label: t('danger.confirm.typeTitle'),
                    expected: route.title,
                    matches: titleMatches(typed, route.title),
                  }
                : undefined
            }
            typed={typed}
            onTyped={setTyped}
            onConfirm={confirm}
            onCancel={close}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
