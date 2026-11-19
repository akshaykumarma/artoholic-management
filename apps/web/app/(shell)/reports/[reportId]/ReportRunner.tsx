'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatDateIST, formatDateTimeIST, formatMoney, formatPlainDate, formatQuantity, t, type MessageKey, type ReportDef, type ReportResult } from '@artoholic/shared';
import { api } from '@/lib/api';

type Opt = { id: string; label: string };

function cell(type: string, v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'money') return formatMoney(Number(v));
  if (type === 'quantity') return formatQuantity(String(v), null);
  if (type === 'datetime') return formatDateTimeIST(String(v));
  if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? formatPlainDate(String(v)) : formatDateIST(String(v));
  return String(v);
}

/** Filters, paged table and Excel download for one report (009 US1). */
export default function ReportRunner({ def, options }: { def: ReportDef; options: Record<string, Opt[]> }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const clean = () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const load = useCallback(async (p: number) => {
    setMsg(null);
    try {
      setResult(await api.post<ReportResult>(`/api/v1/reports/${def.id}/run`, { filters: clean(), page: p, pageSize: 100 }));
      setPage(p);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('error.INTERNAL'));
    }
  }, [def.id, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  async function exportXlsx() {
    const r = await api.post<{ runId: string }>(`/api/v1/reports/${def.id}/export`, { filters: clean() });
    window.location.assign(`/api/v1/reports/runs/${r.runId}/download`);
  }
  return (
    <>
      <form method="post" onSubmit={(e) => { e.preventDefault(); void load(1); }} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        {def.filters.map((f) => (
          <div key={f}>
            <label htmlFor={`rf-${f}`}>{t(`rpt.filter.${f}` as MessageKey)}</label>
            {f === 'from' || f === 'to' ? (
              <input id={`rf-${f}`} type="date" value={filters[f] ?? ''} onChange={(e) => setFilters({ ...filters, [f]: e.target.value })} />
            ) : options[f]?.length ? (
              <select id={`rf-${f}`} value={filters[f] ?? ''} onChange={(e) => setFilters({ ...filters, [f]: e.target.value })}>
                <option value="">{t('rpt.any')}</option>
                {options[f]!.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            ) : (
              <input id={`rf-${f}`} value={filters[f] ?? ''} onChange={(e) => setFilters({ ...filters, [f]: e.target.value })} />
            )}
          </div>
        ))}
        <button type="submit">{t('rpt.run')}</button>
        <button type="button" className="secondary" onClick={() => void exportXlsx()}>{t('rpt.export')}</button>
      </form>
      {msg ? <p role="alert" className="error">{msg}</p> : null}
      {result ? (
        <>
          <p className="muted">{t('rpt.rows', { n: result.total })}</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>{result.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {result.rows.length ? result.rows.map((r, i) => (
                  <tr key={i}>{result.columns.map((c) => <td key={c.key}>{cell(c.type, r[c.key])}</td>)}</tr>
                )) : <tr><td colSpan={result.columns.length}>{t('rpt.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 ? (
            <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="secondary" disabled={page <= 1} onClick={() => void load(page - 1)}>{t('rpt.prev')}</button>
              <span>{t('rpt.page', { page, pages })}</span>
              <button type="button" className="secondary" disabled={page >= pages} onClick={() => void load(page + 1)}>{t('rpt.next')}</button>
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}
