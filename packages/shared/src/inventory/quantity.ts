import Decimal from 'decimal.js';

/** Quantities travel as decimal strings with up to 3 places (research R4/R5); never floats. */
const QTY = /^\d+(\.\d{1,3})?$/;
const SIGNED = /^-?\d+(\.\d{1,3})?$/;

export function isQuantity(v: string, opts: { counted?: boolean; signed?: boolean } = {}): boolean {
  if (!(opts.signed ? SIGNED : QTY).test(v)) return false;
  if (opts.counted && v.includes('.') && !/\.0+$/.test(v)) return false;
  return true;
}

export const q = (v: string | number) => new Decimal(v);

/** Normalised 3-decimal string ("12.500"), as PostgreSQL numeric(14,3) returns it. */
export function toQty(d: Decimal.Value): string {
  return new Decimal(d).toFixed(3);
}

/** Converts between units of one family: value × fromFactor ÷ toFactor, rounded half-up to 3 dp. */
export function convertQuantity(value: string, fromFactor: string | number, toFactor: string | number): string {
  return new Decimal(value).mul(fromFactor).div(toFactor).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
}

export function qtyCompare(a: string, b: string): number {
  return new Decimal(a).cmp(b);
}
