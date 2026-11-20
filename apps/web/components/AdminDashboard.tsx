'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney, formatPlainDate, t, type Dashboard } from '@artoholic/shared';
import { api } from '@/lib/api';
import StatusPill from './StatusPill';

/** Admin home figures, refreshed every 60 s; each links to the list behind it (009 US3). */
export default function AdminDashboard({ initial }: { initial: Dashboard }) {
  const [d, setD] = useState(initial);
  useEffect(() => {
    const h = setInterval(() => void api.get<Dashboard>('/api/v1/dashboard').then(setD).catch(() => undefined), 60_000);
    return () => clearInterval(h);
  }, []);
  const tile = (label: string, value: string | number, href: string) => (
    <Link href={href} className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" data-testid={`dash-${label}`}>{value}</div>
    </Link>
  );
  const p = d.pendingApprovals;
  return (
    <section className="card" aria-label={t('dash.title')}>
      <h3>{t('dash.title')}</h3>
      <p><Link href="/reports/R6">{t('dash.today', { d: d.today.dispatches, r: d.today.returns })}</Link></p>
      <p><Link href="/reports/R6">{t('dash.week', { d: d.week.dispatches, r: d.week.returns })}</Link></p>
      <div className="stats">
        {tile(t('dash.damage'), p.damage, '/approvals')}
        {tile(t('dash.variances'), p.variances, '/counts')}
        {tile(t('dash.writeOffs'), p.writeOffs, '/inventory/approvals')}
        {tile(t('dash.corrections'), p.corrections, '/inventory/approvals')}
        {tile(t('dash.shortfalls'), p.transferShortfalls, '/warehouses/transfers')}
        {tile(t('dash.damageValue'), formatMoney(d.damageValueMonthPaise), '/reports/R4')}
        {tile(t('dash.lowStock'), d.lowStockCount, '/inventory?belowMinimum=true')}
        {tile(t('dash.overbooked'), d.overbookedCount, '/events?overbooked=true')}
      </div>
      <h4>{t('dash.events')}</h4>
      <p className="pills">{Object.entries(d.eventsByStatus).map(([s, n]) => <span key={s}><StatusPill status={s} /> {n}</span>)}</p>
      {d.nextCounts.length ? <><h4>{t('dash.nextCounts')}</h4><ul>{d.nextCounts.map((c, i) => <li key={i}>{`${c.name} · ${formatPlainDate(c.dueDate)}`}</li>)}</ul></> : null}
    </section>
  );
}
