import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FilmStrip } from './FilmStrip.js';
import { Icon, type IconName } from './Icon.js';

/** Placeholder cards while a list loads: the page keeps its shape. */
export function RouteListSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true">
      <ul className="route-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="card route-card">
            <div className="skel route-card-media" />
            <div className="route-card-main">
              <div className="skel-block">
                <div className="skel title" />
                <div className="skel line" style={{ width: '40%' }} />
                <div className="skel line" style={{ width: '80%' }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="note" role="status" style={{ marginTop: 'var(--sp-4)' }}>
        {t('common.loading')}
      </p>
    </div>
  );
}

export function EmptyState({
  icon = 'film',
  title,
  text,
  strip = false,
  children,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  /** Draw an empty strip of film instead of the icon: a route with nothing in it yet. */
  strip?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      {strip ? (
        <div className="empty-strip" aria-hidden="true">
          <FilmStrip
            label=""
            frames={Array.from({ length: 5 }, () => ({
              posterUrl: null,
              state: 'pending' as const,
            }))}
          />
        </div>
      ) : (
        <div className="ill">
          <Icon name={icon} size={32} />
        </div>
      )}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

/** A failed load: say what happened and offer a way forward. */
export function ErrorBox({
  message,
  onRetry,
  children,
}: {
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="error-box" role="alert">
      <h2>{t('common.loadFailed')}</h2>
      <p>{message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {t('common.retry')}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
