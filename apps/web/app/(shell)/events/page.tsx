import Link from 'next/link';
import { EVENT_STATUSES, formatDateTimeIST, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listEvents, listEventTypes } from '@/server/events/views';

export const dynamic = 'force-dynamic';

type SP = { status?: string; from?: string; to?: string; typeId?: string; overbooked?: string; q?: string };

export default async function EventsPage({ searchParams }: { searchParams: SP }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.view')) return <Forbidden />;
  const status = (EVENT_STATUSES as readonly string[]).includes(searchParams.status ?? '') ? searchParams.status : undefined;
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
  const { items } = await listEvents(auth, {
    status, from: date(searchParams.from), to: date(searchParams.to), typeId: uuid(searchParams.typeId), overbooked: searchParams.overbooked === 'true', q: searchParams.q
  });
  const types = await listEventTypes();
  return (
    <section className="card">
      <h2>{t('ev.title')}</h2>
      <p style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {can(auth, 'events.manage') ? <Link href="/events/new">{t('ev.new')}</Link> : null}
        <Link href="/events/calendar">{t('ev.calendar')}</Link>
      </p>
      <form method="get" role="search" style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 180 }}>
          <label htmlFor="ev-q">{t('ev.search')}</label>
          <input id="ev-q" name="q" defaultValue={searchParams.q ?? ''} />
        </div>
        <div>
          <label htmlFor="ev-status">{t('ev.status')}</label>
          <select id="ev-status" name="status" defaultValue={status ?? ''}>
            <option value="">{t('ev.any')}</option>
            {EVENT_STATUSES.map((s) => <option key={s} value={s}>{t(`ev.status.${s}` as MessageKey)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ev-type">{t('ev.type')}</label>
          <select id="ev-type" name="typeId" defaultValue={searchParams.typeId ?? ''}>
            <option value="">{t('ev.any')}</option>
            {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ev-from">{t('ev.from')}</label>
          <input id="ev-from" name="from" type="date" defaultValue={searchParams.from ?? ''} />
        </div>
        <div>
          <label htmlFor="ev-to">{t('ev.to')}</label>
          <input id="ev-to" name="to" type="date" defaultValue={searchParams.to ?? ''} />
        </div>
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" name="overbooked" value="true" defaultChecked={searchParams.overbooked === 'true'} style={{ width: 20, minHeight: 20 }} />
          {t('ev.overbookedOnly')}
        </label>
        <button type="submit">{t('ev.filter')}</button>
      </form>
      <table>
        <thead><tr><th>{t('ev.number')}</th><th>{t('ev.name')}</th><th>{t('ev.when')}</th><th>{t('ev.venue')}</th><th>{t('ev.status')}</th></tr></thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.number}</td>
              <td><Link href={`/events/${e.id}`}>{e.name || e.number}</Link></td>
              <td>{e.startsAt ? formatDateTimeIST(e.startsAt) : ''}</td>
              <td>{e.venueName}</td>
              <td>{t(`ev.status.${e.status}` as MessageKey)}{e.overbooked ? <strong className="error">{` · ${t('ev.overbooked')}`}</strong> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
