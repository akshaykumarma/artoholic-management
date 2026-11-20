import Link from 'next/link';
import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { auditQuery, searchAudit } from '@/server/admin/audit';
import AuditExport from './AuditExport';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'audit.view')) return <Forbidden />;
  const parsed = auditQuery.safeParse(Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v)));
  const q = parsed.success ? parsed.data : {};
  const { items, nextCursor } = await searchAudit(q);
  const field = (name: string, label: string, type = 'text') => (
    <div><label htmlFor={`a-${name}`}>{label}</label><input id={`a-${name}`} name={name} type={type} defaultValue={searchParams[name] ?? ''} /></div>
  );
  const next = new URLSearchParams(Object.entries({ ...q, cursor: nextCursor ?? '' }).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  return (
    <section className="card">
      <h2>{t('adm.audit')}</h2>
      <p className="muted">{t('adm.readOnly')}</p>
      <form method="get" role="search" style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        {field('from', t('adm.from'), 'date')}{field('to', t('adm.to'), 'date')}{field('action', t('adm.action'))}{field('entityType', t('adm.recordType'))}{field('entityId', t('adm.record'))}
        <button type="submit">{t('adm.search')}</button>
      </form>
      <AuditExport query={Object.fromEntries(Object.entries(q).filter(([k, v]) => k !== 'cursor' && v !== undefined).map(([k, v]) => [k, String(v)]))} />
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>{t('adm.when')}</th><th>{t('adm.who')}</th><th>{t('adm.action')}</th><th>{t('adm.record')}</th><th>{t('adm.before')}</th><th>{t('adm.after')}</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateTimeIST(a.at)}</td>
                <td>{a.actor ?? ''}</td>
                <td>{a.action}</td>
                <td>{[a.entityType, a.entityId].filter(Boolean).join(' ')}</td>
                <td><code style={{ fontSize: 12, wordBreak: 'break-word' }}>{a.before ? JSON.stringify(a.before) : ''}</code></td>
                <td><code style={{ fontSize: 12, wordBreak: 'break-word' }}>{a.after ? JSON.stringify(a.after) : ''}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor ? <p><Link href={`/admin/audit?${next.toString()}`}>{t('adm.next')}</Link></p> : null}
    </section>
  );
}
