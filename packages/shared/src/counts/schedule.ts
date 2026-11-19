/**
 * Count schedule due dates (007 research R1): the start date advanced by whole periods; monthly and
 * longer periods keep the start's day of month, clamped to the month's last day (31st → 28 Feb).
 */
export const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];
const MONTHS: Record<Exclude<Frequency, 'weekly'>, number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

const parse = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid date: ${d}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
};
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The k-th due date (k = 0 is the start date). */
export function dueDate(start: string, frequency: Frequency, k: number): string {
  const s = parse(start);
  if (frequency === 'weekly') return new Date(Date.UTC(s.y, s.m - 1, s.d + 7 * k)).toISOString().slice(0, 10);
  const total = s.m - 1 + MONTHS[frequency] * k;
  const y = s.y + Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return fmt(y, m, Math.min(s.d, last));
}

/** First due date on or after `from` (resuming a paused schedule skips the missed periods). */
export function nextDueOnOrAfter(start: string, frequency: Frequency, from: string): string {
  if (from <= start) return start;
  for (let k = 1; k < 10_000; k++) {
    const d = dueDate(start, frequency, k);
    if (d >= from) return d;
  }
  throw new Error('No due date found');
}

/** The due date after `due`. */
export function nextDueAfter(start: string, frequency: Frequency, due: string): string {
  const next = new Date(Date.parse(`${due}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return nextDueOnOrAfter(start, frequency, next);
}
