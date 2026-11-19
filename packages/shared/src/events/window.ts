/**
 * Event date windows (005 research R1): [leave-warehouse date, expected return date] as IST
 * calendar dates, inclusive; windows that touch on the same day overlap.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** IST calendar date of an instant as "YYYY-MM-DD". */
export function istDate(input: string | Date): string {
  const ms = (typeof input === 'string' ? Date.parse(input) : input.getTime()) + IST_OFFSET_MS;
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${String(input)}`);
  return new Date(ms).toISOString().slice(0, 10);
}

export interface DateWindow { start: string; end: string }

export function eventWindow(leaveWarehouseAt: string | Date, expectedReturnDate: string): DateWindow {
  return { start: istDate(leaveWarehouseAt), end: expectedReturnDate };
}

export function windowsOverlap(a: DateWindow, b: DateWindow): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Instant of an IST wall-clock time on a calendar date, e.g. 09:00 IST on "2026-12-01". */
export function istInstant(date: string, hh: number, mm = 0): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + (hh * 60 + mm) * 60_000 - IST_OFFSET_MS);
}
