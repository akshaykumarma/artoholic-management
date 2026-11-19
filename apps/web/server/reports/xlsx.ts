import ExcelJS from 'exceljs';
import { formatDateTimeIST, type ReportDef } from '@artoholic/shared';
import { now } from '../auth/clock';
import type { Row } from './queries';

const IST_MS = 330 * 60_000;

/**
 * Excel export (009 research R2, FR-007): title, filters and IST generation time on top; quantities
 * and money as numbers (₹ format) so sums work; dates as real dates shown DD-MM-YYYY.
 */
export async function toXlsx(def: ReportDef, rows: Row[], filters: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Artoholic';
  const ws = wb.addWorksheet(def.title.slice(0, 31));
  ws.addRow([def.title]).font = { bold: true, size: 14 };
  ws.addRow([`Filters: ${filters || 'none'}`]);
  ws.addRow([`Generated ${formatDateTimeIST(now())}`]);
  ws.addRow([]);
  const header = ws.addRow(def.columns.map((c) => (c.type === 'money' ? `${c.label} (₹)` : c.label)));
  header.font = { bold: true };
  if (!rows.length) ws.addRow(['No data for this period']);
  for (const r of rows) {
    ws.addRow(def.columns.map((c) => {
      const v = r[c.key];
      if (v === null || v === undefined || v === '') return null;
      if (c.type === 'money') return Number(v) / 100;
      if (c.type === 'quantity' || c.type === 'number') return Number(v);
      if (c.type === 'datetime') return new Date(Date.parse(String(v)) + IST_MS);
      if (c.type === 'date') return new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
      return String(v);
    }));
  }
  def.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(12, c.label.length + 4);
    if (c.type === 'money') col.numFmt = '"₹"#,##,##0.00';
    if (c.type === 'quantity') col.numFmt = '#,##0.###';
    if (c.type === 'date') col.numFmt = 'dd-mm-yyyy';
    if (c.type === 'datetime') col.numFmt = 'dd-mm-yyyy hh:mm';
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
