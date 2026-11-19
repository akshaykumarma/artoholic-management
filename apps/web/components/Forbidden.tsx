import Link from 'next/link';
import { t } from '@artoholic/shared';

export default function Forbidden() {
  return (
    <section className="card" role="alert">
      <h2>{t('forbidden.title')}</h2>
      <Link href="/">{t('forbidden.back')}</Link>
    </section>
  );
}
