import { t, CONVENTION_SAMPLES } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';

export default async function ConventionsPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'reference.conventions.view')) return <Forbidden />;
  return (
    <section className="card">
      <h2>{t('conventions.title')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('conventions.input')}</th>
            <th>{t('conventions.output')}</th>
          </tr>
        </thead>
        <tbody>
          {CONVENTION_SAMPLES.map((s) => (
            <tr key={s.label}>
              <td><code>{s.label}</code></td>
              <td data-testid={`sample-${s.id}`}>{s.render()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
