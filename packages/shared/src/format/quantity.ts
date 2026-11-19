const DECIMAL = /^-?\d+(\.\d{1,3})?$/;

/**
 * Quantities travel as decimal strings (research R5): up to 3 decimals, trailing zeros removed,
 * unit abbreviation appended when the item has one (FR-013).
 */
export function formatQuantity(value: string, unit?: string | null): string {
  if (!DECIMAL.test(value)) throw new Error(`Invalid quantity: ${value}`);
  let [int, frac = ''] = value.split('.') as [string, string?];
  frac = frac.replace(/0+$/, '');
  int = int.replace(/^(-?)0+(?=\d)/, '$1');
  const n = frac ? `${int}.${frac}` : int;
  return unit ? `${n} ${unit}` : n;
}
