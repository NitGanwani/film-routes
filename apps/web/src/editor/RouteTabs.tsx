import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { ROUTE_TABS, tabAfterKey, tabPath, type RouteTab } from './tabs.js';

export const tabId = (tab: RouteTab) => `route-tab-${tab}`;
export const panelId = (tab: RouteTab) => `route-panel-${tab}`;

/**
 * Route · Invitations · Travelers, drawn as the segmented control of Explore.
 * Each tab is a page of its own (so "back" works) and the arrows move between
 * them, as a tab list is expected to.
 */
export function RouteTabs({
  routeId,
  tab,
}: {
  routeId: string;
  tab: RouteTab;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const refs = useRef<Partial<Record<RouteTab, HTMLAnchorElement | null>>>({});

  function onKeyDown(event: KeyboardEvent) {
    const next = tabAfterKey(tab, event.key);
    if (!next) return;
    event.preventDefault();
    void navigate(tabPath(routeId, next));
    refs.current[next]?.focus();
  }

  return (
    <div
      className="tabs route-tabs"
      role="tablist"
      aria-label={t('tabs.label')}
      style={{ '--i': ROUTE_TABS.indexOf(tab) } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {ROUTE_TABS.map((option) => (
        <Link
          key={option}
          id={tabId(option)}
          ref={(element) => {
            refs.current[option] = element;
          }}
          role="tab"
          aria-selected={tab === option}
          aria-controls={panelId(option)}
          // Only the current tab is in the tab order; the arrows reach the rest.
          tabIndex={tab === option ? 0 : -1}
          to={tabPath(routeId, option)}
        >
          {t(`tabs.${option}`)}
        </Link>
      ))}
    </div>
  );
}
