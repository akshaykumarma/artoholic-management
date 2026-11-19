/** Indian digit grouping: last 3 digits, then groups of 2 (1,00,00,000). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

/** Money held as integer paise (FR-012): 123456750 → "₹12,34,567.50"; negatives use U+2212. */
export function formatMoney(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error(`Money must be whole paise: ${paise}`);
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = String(abs % 100).padStart(2, '0');
  return `${negative ? '−' : ''}₹${groupIndian(String(rupees))}.${p}`;
}
