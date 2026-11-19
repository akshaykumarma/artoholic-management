import { formatDateTimeIST, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getAdminStatus } from '@/server/health/status';
import MobileVersionsForm from './MobileVersionsForm';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'admin.status.view')) return <Forbidden />;
  const s = await getAdminStatus();
  return (
    <>
      <section className="card">
        <h2>{t('status.title')}</h2>
        <p>
          {t('status.overall')}: <span className={`badge ${s.overall}`} data-testid="overall">{t(`status.${s.overall}` as MessageKey)}</span>
        </p>
        <table>
          <tbody>
            {s.parts.map((p) => (
              <tr key={p.part}>
                <td>{t(`status.part.${p.part}` as MessageKey)}</td>
                <td><span className={`badge ${p.status}`} data-testid={`part-${p.part}`}>{t(`status.${p.status}` as MessageKey)}</span></td>
                <td className="muted">{t('status.checkedAt', { time: formatDateTimeIST(p.checkedAt) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{t('status.version')}: {s.platformVersion}</p>
      </section>
      <MobileVersionsForm initial={s.mobileVersions} />
    </>
  );
}
