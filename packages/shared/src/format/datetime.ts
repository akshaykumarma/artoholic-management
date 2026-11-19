/**
 * IST formatting by fixed offset (+05:30, no daylight saving) with hand-built digits, so web,
 * Android (Hermes) and iOS print identical text and the device time zone never matters
 * (FR-010, FR-011, research R4).
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function istParts(input: string | Date) {
  const ms = (typeof input === 'string' ? Date.parse(input) : input.getTime()) + IST_OFFSET_MS;
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${String(input)}`);
  const d = new Date(ms); // read with UTC getters: they now hold IST wall-clock values
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}

/** "20-11-2026 00:00 IST" */
export function formatDateTimeIST(input: string | Date): string {
  const p = istParts(input);
  return `${pad(p.day)}-${pad(p.m)}-${p.y} ${pad(p.h)}:${pad(p.min)} IST`;
}

/** Date of an instant in IST: "01-01-2027". */
export function formatDateIST(input: string | Date): string {
  const p = istParts(input);
  return `${pad(p.day)}-${pad(p.m)}-${p.y}`;
}

/** Calendar date with no time of day ("2026-11-20" → "20-11-2026"); never shifted. */
export function formatPlainDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Invalid calendar date: ${isoDate}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** IST calendar year of an instant (record numbering, FR-014). */
export function istYear(input: string | Date): number {
  return istParts(input).y;
}
