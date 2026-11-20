import { t, type MessageKey } from '@artoholic/shared';

/** Event status as a coloured pill. */
export default function StatusPill({ status }: { status: string }) {
  return <span className={`pill st-${status}`}>{t(`ev.status.${status}` as MessageKey)}</span>;
}
