import { randomUUID } from 'node:crypto';
import { REPORTS, type ReportFilters, type ReportId } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { ApiError } from '../http/errors';
import { now } from '../auth/clock';
import { getStorage } from '../storage';
import type { Authenticated } from '../auth/sessions';
import { QUERIES, type Row } from './queries';
import { scopeFor, type Scope } from './scope';
import { toXlsx } from './xlsx';

export async function rowsFor(reportId: ReportId, scope: Scope, filters: ReportFilters): Promise<Row[]> {
  return QUERIES[reportId](scope, filters);
}

/** On-screen run with paging (US1); managers are limited to their warehouses or events (FR-005). */
export async function runReport(auth: Authenticated, reportId: ReportId, filters: ReportFilters, page: number, pageSize: number) {
  const def = REPORTS[reportId];
  const rows = await rowsFor(reportId, await scopeFor(auth), filters);
  return { columns: def.columns, rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export async function describeFilters(f: ReportFilters): Promise<string> {
  const pool = getPool();
  const parts: string[] = [];
  if (f.from || f.to) parts.push(`${f.from ?? '…'} to ${f.to ?? '…'}`);
  const name = async (sql: string, id?: string) => (id ? (await pool.query<{ n: string }>(sql, [id])).rows[0]?.n ?? id : null);
  for (const v of [
    await name('SELECT code AS n FROM warehouses WHERE id = $1', f.warehouseId), await name('SELECT name AS n FROM categories WHERE id = $1', f.categoryId),
    await name('SELECT number AS n FROM events WHERE id = $1', f.eventId), await name('SELECT full_name AS n FROM users WHERE id = $1', f.userId),
    await name('SELECT number AS n FROM count_sessions WHERE id = $1', f.sessionId)
  ]) if (v) parts.push(v);
  return parts.join(' · ');
}

/** Generates the .xlsx, stores it and records the run. */
export async function exportReport(o: { auth: Authenticated | null; reportId: ReportId; filters: ReportFilters; scheduleId?: string; runDate?: string; runId?: string }) {
  const pool = getPool();
  const def = REPORTS[o.reportId];
  const runId = o.runId ?? (await pool.query<{ id: string }>(
    'INSERT INTO report_runs (report_id, schedule_id, run_date, requested_by, filters, started_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [o.reportId, o.scheduleId ?? null, o.runDate ?? null, o.auth?.user.id ?? null, JSON.stringify(o.filters), now()]
  )).rows[0]!.id;
  try {
    const rows = await rowsFor(o.reportId, await scopeFor(o.auth), o.filters);
    const buf = await toXlsx(def, rows, await describeFilters(o.filters));
    const fileName = `${def.title.replace(/[^\w]+/g, '-')}-${new Date(now().getTime() + 330 * 60_000).toISOString().slice(0, 10)}.xlsx`;
    const key = `reports/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.xlsx`;
    await getStorage().putObject(key, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await pool.query("UPDATE report_runs SET status = 'succeeded', finished_at = $2, row_count = $3, file_key = $4, file_name = $5, file_bytes = $6 WHERE id = $1",
      [runId, now(), rows.length, key, fileName, buf.length]);
    return { runId, rowCount: rows.length, key, fileName, bytes: buf.length };
  } catch (err) {
    await pool.query("UPDATE report_runs SET status = 'failed', finished_at = $2, error = $3 WHERE id = $1", [runId, now(), (err as Error).message.slice(0, 500)]);
    throw err;
  }
}

export async function runStatus(auth: Authenticated, runId: string) {
  const { rows } = await getPool().query<{ id: string; status: 'running' | 'succeeded' | 'failed'; row_count: number | null; file_name: string | null; error: string | null; requested_by: string | null }>(
    'SELECT id, status, row_count, file_name, error, requested_by FROM report_runs WHERE id = $1', [runId]
  );
  const r = rows[0];
  const admin = auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
  if (!r || (!admin && r.requested_by !== auth.user.id)) throw new ApiError('NOT_FOUND');
  return { id: r.id, status: r.status, rowCount: r.row_count, fileName: r.file_name, error: r.error, downloadUrl: r.status === 'succeeded' ? `/api/v1/reports/runs/${r.id}/download` : null };
}

export async function runFile(auth: Authenticated, runId: string) {
  const { rows } = await getPool().query<{ file_key: string | null; file_name: string | null; requested_by: string | null }>('SELECT file_key, file_name, requested_by FROM report_runs WHERE id = $1', [runId]);
  const r = rows[0];
  const admin = auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
  if (!r?.file_key || (!admin && r.requested_by !== auth.user.id)) throw new ApiError('NOT_FOUND');
  const body = await getStorage().getObject(r.file_key);
  if (!body) throw new ApiError('NOT_FOUND');
  return { body, fileName: r.file_name ?? 'report.xlsx' };
}
