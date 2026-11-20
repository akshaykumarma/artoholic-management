import { formatDateTimeIST, RELEASE_CHECKS, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listReleases } from '@/server/releases';
import ReleaseForms from './ReleaseForms';

export const dynamic = 'force-dynamic';

export default async function ReleasesPage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  const items = await listReleases();
  return (
    <>
      <section className="card">
        <h2>{t('rel.title')}</h2>
        {items.map((r) => (
          <div key={r.id} className="card" style={{ padding: 12 }}>
            <h3>{`${r.platform} ${r.version} (${r.buildNumber}) · ${t(`rel.status.${r.storeStatus}` as MessageKey)}`}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</p>
            {r.rejectionReason ? <p className="error">{r.rejectionReason}</p> : null}
            <ul>
              {RELEASE_CHECKS.map((k) => {
                const c = r.checks.find((x) => x.check === k);
                return <li key={k}>{`${c?.passed ? '✓' : '○'} ${t(`rel.check.${k}` as MessageKey)}${c ? ` · ${c.testedBy} · ${c.device} · ${formatDateTimeIST(c.at)}` : ''}`}</li>;
              })}
            </ul>
            <ReleaseForms releaseId={r.id} />
          </div>
        ))}
      </section>
      <ReleaseForms />
    </>
  );
}
