/**
 * Location codes (004 research R1–R2): WAREHOUSE-L1-L2-…, e.g. MAIN-A-03-02. Ranges are either
 * letters (A–D) or numbers (1–10); numbers are zero-padded to two digits, or wider if the range needs it.
 */
export type Range = { from: string | number; to: string | number } | { list: string[] };

export function expandRange(r: Range): string[] {
  if ('list' in r) return r.list.map((s) => s.trim().toUpperCase()).filter(Boolean);
  const from = String(r.from).trim().toUpperCase();
  const to = String(r.to).trim().toUpperCase();
  if (/^\d+$/.test(from) && /^\d+$/.test(to)) {
    const a = Number(from);
    const b = Number(to);
    if (b < a) throw new Error(`Range ${from}–${to} runs backwards`);
    const width = Math.max(2, String(b).length); // spec: MAIN-A-01-01; 1–10 → 01…10
    return Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(width, '0'));
  }
  if (/^[A-Z]$/.test(from) && /^[A-Z]$/.test(to)) {
    const a = from.charCodeAt(0);
    const b = to.charCodeAt(0);
    if (b < a) throw new Error(`Range ${from}–${to} runs backwards`);
    return Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i));
  }
  if (from === to && /^[A-Z0-9]{1,6}$/.test(from)) return [from];
  throw new Error(`Use letters (A–D) or numbers (1–10), not "${from}–${to}"`);
}

/** All bin paths for per-level ranges, in walking order. */
export function expandBins(ranges: Range[]): string[][] {
  return ranges.reduce<string[][]>((acc, r) => acc.flatMap((path) => expandRange(r).map((seg) => [...path, seg])), [[]]);
}

export function locationCode(warehouseCode: string, segments: string[]): string {
  return [warehouseCode, ...segments].join('-');
}
