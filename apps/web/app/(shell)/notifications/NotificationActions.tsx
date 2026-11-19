'use client';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

type Row = { id: string; title: string; body: string; path: string | null; when: string; unread: boolean };

/** Opening a notification marks it read and follows its deep link (US2). */
export default function NotificationActions({ items }: { items: Row[] }) {
  const router = useRouter();
  if (!items.length) return <p className="muted">{t('ntf.none')}</p>;
  return (
    <>
      <button type="button" className="secondary" onClick={() => api.post('/api/v1/notifications/read-all', {}).then(() => router.refresh())}>{t('ntf.readAll')}</button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((n) => (
          <li key={n.id} className="card" style={{ padding: 12, borderLeft: n.unread ? '4px solid #EBAB3F' : undefined }}>
            <a href={n.path ?? '#'} onClick={(e) => {
              e.preventDefault();
              void api.post(`/api/v1/notifications/${n.id}/read`, {}).finally(() => { if (n.path) router.push(n.path); else router.refresh(); });
            }}>
              <strong>{n.title}</strong>
            </a>
            {n.body ? <div>{n.body}</div> : null}
            <div className="muted">{n.when}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
