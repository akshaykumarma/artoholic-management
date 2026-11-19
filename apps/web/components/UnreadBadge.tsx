'use client';
import { useEffect, useState } from 'react';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

/** Unread count beside the Notifications menu item, refreshed every 30 s (US2-1). */
export default function UnreadBadge({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const tick = () => void api.get<{ unread: number }>('/api/v1/notifications/unread-count').then((r) => setN(r.unread)).catch(() => undefined);
    const h = setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(h); window.removeEventListener('focus', tick); };
  }, []);
  if (!n) return null;
  return <span className="badge" role="status" aria-label={t('ntf.unread', { n })} style={{ marginLeft: 6, background: '#EBAB3F', color: '#4A5055', borderRadius: 10, padding: '0 8px', fontSize: 12, fontWeight: 700 }}>{n}</span>;
}
