'use client';
import { useState, type FormEvent } from 'react';
import { t } from '@artoholic/shared';

type Preview = { id: string; totalRows: number; validRows: number; errors: Array<{ row: number; message: string }> };
const csrf = () => document.cookie.split('; ').find((c) => c.startsWith('csrf='))?.slice(5) ?? '';
const headers = () => ({ 'x-client-platform': 'web', 'x-client-version': '0.1.0', 'x-csrf-token': decodeURIComponent(csrf()) });

/** Upload → dry-run preview with row errors → commit (003 US2). */
export default function ImportForm() {
  const [kind, setKind] = useState<'items' | 'opening_stock'>('items');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function check(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setMsg(null);
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', file);
    const res = await fetch('/api/v1/imports', { method: 'POST', body: form, headers: headers(), credentials: 'include' });
    const body = await res.json();
    if (!res.ok) return setMsg(body.error?.message ?? t('error.INTERNAL'));
    setPreview(body);
  }

  async function commit() {
    if (!preview) return;
    const res = await fetch(`/api/v1/imports/${preview.id}/commit`, { method: 'POST', headers: headers(), credentials: 'include' });
    const body = await res.json();
    setMsg(res.ok ? t('inv.import.done', { n: body.committed }) : body.error?.message ?? t('error.INTERNAL'));
    if (res.ok) setPreview(null);
  }

  return (
    <section className="card">
      <h2>{t('inv.import')}</h2>
      <form method="post" onSubmit={check}>
        <label htmlFor="kind">{t('inv.import.kind')}</label>
        <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={{ minHeight: 44, width: '100%' }}>
          <option value="items">{t('inv.import.items')}</option>
          <option value="opening_stock">{t('inv.import.opening')}</option>
        </select>
        <p><a href={`/api/v1/imports/templates/${kind}`}>{t('inv.import.template')}</a></p>
        <label htmlFor="file">{t('inv.import.file')}</label>
        <input id="file" type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit">{t('inv.import.preview')}</button>
      </form>
      {preview ? (
        <div>
          <p>{t('inv.import.rows', { valid: preview.validRows, total: preview.totalRows })}</p>
          <ul>{preview.errors.map((er) => <li key={er.row} className="error">{t('inv.import.row', { row: er.row, message: er.message })}</li>)}</ul>
          {preview.errors.length === 0 ? <button type="button" onClick={commit}>{t('inv.import.commit', { n: preview.validRows })}</button> : null}
        </div>
      ) : null}
      {msg ? <p role="status">{msg}</p> : null}
    </section>
  );
}
