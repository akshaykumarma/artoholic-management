import Link from 'next/link';
import { istDate, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { calendarMonth } from '@/server/events/views';

export const dynamic = 'force-dynamic';

const shift = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

export default async function CalendarPage({ searchParams }: { searchParams: { month?: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.view')) return <Forbidden />;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month ?? '') ? searchParams.month! : istDate(new Date()).slice(0, 7);
  const items = await calendarMonth(auth, month);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // weeks start on Monday
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const on = (d: string) => items.filter((e) => e.startsAt && istDate(e.startsAt) <= d && istDate(e.endsAt ?? e.startsAt) >= d);
  return (
    <section className="card">
      <h2>{`${t('ev.calendar')} · ${month}`}</h2>
      <p style={{ display: 'flex', gap: 16 }}>
        <Link href={`/events/calendar?month=${shift(month, -1)}`}>{t('ev.prevMonth')}</Link>
        <Link href={`/events/calendar?month=${shift(month, 1)}`}>{t('ev.nextMonth')}</Link>
        <Link href="/events">{t('ev.list')}</Link>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {cells.map((d, i) => (
          <div key={i} style={{ minHeight: 72, border: d ? '1px solid #e2e2e2' : 'none', borderRadius: 6, padding: 4, fontSize: 13, overflow: 'hidden' }}>
            {d ? <div className="muted">{Number(d.slice(8))}</div> : null}
            {d ? on(d).map((e) => (
              <div key={e.id}><Link href={`/events/${e.id}`}>{e.overbooked ? `⚠ ${e.name}` : e.name}</Link></div>
            )) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
