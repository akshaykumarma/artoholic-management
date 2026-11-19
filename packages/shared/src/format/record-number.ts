export type RecordKind = 'event' | 'damage_report' | 'count_session' | 'stock_transfer' | 'item';

const FORMATS: Record<RecordKind, { prefix: string; digits: number; yearly: boolean }> = {
  event: { prefix: 'EVT', digits: 4, yearly: true },
  damage_report: { prefix: 'DMG', digits: 5, yearly: true },
  count_session: { prefix: 'CNT', digits: 4, yearly: true },
  stock_transfer: { prefix: 'TRF', digits: 4, yearly: true },
  item: { prefix: 'ITM', digits: 5, yearly: false }
};

export const YEARLY_KINDS = (Object.keys(FORMATS) as RecordKind[]).filter((k) => FORMATS[k].yearly);

export function isYearly(kind: RecordKind): boolean {
  return FORMATS[kind].yearly;
}

/** "EVT-2026-0001"; longer numbers keep growing ("EVT-2026-10000") (FR-014). */
export function formatRecordNumber(kind: RecordKind, year: number, n: number): string {
  const f = FORMATS[kind];
  const num = String(n).padStart(f.digits, '0');
  return f.yearly ? `${f.prefix}-${year}-${num}` : `${f.prefix}-${num}`;
}
