import Link from 'next/link';
import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { activeSessions, signIns } from '@/server/admin/activity';
import EndSessionButton from './EndSessionButton';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  const [ins, sess] = await Promise.all([signIns({}), activeSessions()]);
  return (
    <>
      <section className="card">
        <h2>{t('adm.activity')}</h2>
        <p><Link href="/admin/messages">{t('adm.messages')}</Link></p>
        <h3>{t('adm.sessions')}</h3>
        <table>
          <thead><tr><th>{t('adm.user')}</th><th>{t('adm.app')}</th><th>{t('adm.lastSeen')}</th><th /></tr></thead>
          <tbody>
            {sess.map((s) => (
              <tr key={s.id}>
                <td>{s.user}</td><td>{s.platform}</td><td>{formatDateTimeIST(s.lastSeenAt)}</td>
                <td>{s.id === auth.session.id ? null : <EndSessionButton id={s.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3>{t('adm.signIns')}</h3>
        <table>
          <thead><tr><th>{t('adm.when')}</th><th>{t('adm.who')}</th><th>{t('adm.result')}</th><th>{t('adm.app')}</th></tr></thead>
          <tbody>
            {ins.map((s, i) => (
              <tr key={i}><td>{formatDateTimeIST(s.at)}</td><td>{s.who ?? ''}</td><td className={s.result === 'failed' ? 'error' : undefined}>{s.result}</td><td>{s.platform ?? ''}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
