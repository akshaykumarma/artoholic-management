import Link from 'next/link';
import { formatPlainDate, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getSheet } from '@/server/counts/sheet';
import { listItems } from '@/server/catalogue/items';
import CountSheetForm from './CountSheetForm';

export const dynamic = 'force-dynamic';

export default async function SheetPage({ params }: { params: { sessionId: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'counts.perform')) return <Forbidden />;
  const sheet = await getSheet(auth, params.sessionId).catch(() => null);
  if (!sheet) return <Forbidden />;
  const items = sheet.canCount ? (await listItems({})).items.map((i) => ({ id: i.id, label: `${i.code} · ${i.name}` })) : [];
  return (
    <>
      <section className="card">
        <p><Link href="/counts">{t('cnt.title')}</Link></p>
        <h2>{`${t('cnt.sheet')} · ${sheet.number}`}</h2>
        <p>{[formatPlainDate(sheet.dueDate), t(`cnt.status.${sheet.status}` as MessageKey), sheet.blind ? t('cnt.blind') : ''].filter(Boolean).join(' · ')}</p>
        {can(auth, 'counts.schedule') && sheet.status !== 'open' ? <p><Link href={`/counts/${sheet.id}/review`}>{t('cnt.review')}</Link></p> : null}
      </section>
      <CountSheetForm sheet={sheet} items={items} />
    </>
  );
}
