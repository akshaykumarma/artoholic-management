'use client';
import { useState } from 'react';
import { t } from '@artoholic/shared';

const csrf = () => decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('csrf='))?.slice(5) ?? '');

export default function AuditExport({ query }: { query: Record<string, string> }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setMsg(null);
    const res = await fetch('/api/v1/admin/audit/export', { method: 'POST', credentials: 'include', body: JSON.stringify(query),
      headers: { 'content-type': 'application/json', 'x-client-platform': 'web', 'x-client-version': '0.1.0', 'x-csrf-token': csrf() } });
    if (res.status === 202) return setMsg(t('adm.exportQueued'));
    if (!res.ok) return setMsg(t('error.INTERNAL'));
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <p>
      <button type="button" className="secondary" onClick={() => void run()}>{t('adm.export')}</button>
      {msg ? <span role="status">{` ${msg}`}</span> : null}
    </p>
  );
}
