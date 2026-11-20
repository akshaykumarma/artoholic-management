'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

type Value = { id: string; value: string; status: 'active' | 'archived'; inUse: boolean };

/** Values in use can only be archived (010 US3-1). */
export default function ListEditor({ list, values, canAdd }: { list: string; values: Value[]; canAdd: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const call = (p: Promise<unknown>) => p.then(() => { setErr(null); router.refresh(); }).catch((e: Error) => setErr(e.message));
  return (
    <>
      <table>
        <tbody>
          {values.map((v) => (
            <tr key={v.id}>
              <td>{v.value}</td>
              <td className="muted">{[v.inUse ? t('adm.inUse') : '', v.status === 'archived' ? t('adm.archived') : ''].filter(Boolean).join(' · ')}</td>
              <td style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="secondary" onClick={() => call(api.patch(`/api/v1/admin/lists/${list}`, { id: v.id, status: v.status === 'active' ? 'archived' : 'active' }))}>{v.status === 'active' ? t('adm.archive') : t('adm.restore')}</button>
                {!v.inUse ? <button type="button" className="secondary" onClick={() => call(api.patch(`/api/v1/admin/lists/${list}`, { id: v.id, delete: true }))}>{t('adm.delete')}</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canAdd ? (
        <form method="post" onSubmit={(e) => { e.preventDefault(); void call(api.post(`/api/v1/admin/lists/${list}`, { value })).then(() => setValue('')); }} style={{ display: 'flex', gap: 8 }}>
          <input aria-label={t('adm.addValue')} value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit">{t('adm.addValue')}</button>
        </form>
      ) : null}
      {err ? <p role="alert" className="error">{err}</p> : null}
    </>
  );
}
