import { useTranslation } from 'react-i18next';
import type { Traveler } from '../api/types.js';
import { Icon, type IconName } from '../components/Icon.js';

/** One icon per state, so the chip never depends on its colour. */
const STATUS_ICON = {
  active: 'journey',
  completed: 'check',
  abandoned: 'eye-off',
  removed: 'eye-off',
} as const satisfies Record<Traveler['status'], IconName>;

/** Where a traveler is on the route: on their way, finished or gone. */
export function TravelerChip({ status }: { status: Traveler['status'] }) {
  const { t } = useTranslation();
  return (
    <span className="traveler-chip" data-status={status}>
      <Icon name={STATUS_ICON[status]} size={14} />
      {t(`travelers.status.${status}`)}
    </span>
  );
}
