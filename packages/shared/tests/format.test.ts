import { describe, it, expect } from 'vitest';
import {
  formatDateTimeIST, formatDateIST, formatPlainDate, istYear,
  formatMoney, formatQuantity, formatPhone, formatRecordNumber
} from '../src/format';

// Every row of specs/001-overview/contracts/display-conventions.md (SC-002).
describe('display conventions', () => {
  it.each([
    ['2026-11-19T18:30:00Z', '20-11-2026 00:00 IST'],
    ['2026-12-31T18:29:59Z', '31-12-2026 23:59 IST'],
    ['2026-01-01T00:00:00Z', '01-01-2026 05:30 IST']
  ])('formatDateTimeIST(%s) = %s', (input, out) => expect(formatDateTimeIST(input)).toBe(out));

  it('formatDateIST from an instant crosses the date line in IST', () => {
    expect(formatDateIST('2026-12-31T18:30:00Z')).toBe('01-01-2027');
  });

  it('formatPlainDate never shifts a calendar date', () => {
    expect(formatPlainDate('2026-11-20')).toBe('20-11-2026');
  });

  it('istYear uses the IST calendar year', () => {
    expect(istYear('2026-12-31T18:30:00Z')).toBe(2027);
    expect(istYear('2026-12-31T18:29:59Z')).toBe(2026);
  });

  it.each([
    [123456750, '₹12,34,567.50'],
    [0, '₹0.00'],
    [-120000, '−₹1,200.00'],
    [10000000, '₹1,00,000.00'],
    [99, '₹0.99'],
    [100000000000, '₹1,00,00,00,000.00']
  ])('formatMoney(%i paise) = %s', (paise, out) => expect(formatMoney(paise)).toBe(out));

  it('formatMoney refuses non-integer paise', () => {
    expect(() => formatMoney(1.5)).toThrow();
  });

  it.each([
    ['12.500', 'm', '12.5 m'],
    ['40', undefined, '40'],
    ['0.125', 'kg', '0.125 kg'],
    ['3.000', 'kg', '3 kg'],
    ['0', undefined, '0']
  ])('formatQuantity(%s, %s) = %s', (q, unit, out) => expect(formatQuantity(q, unit)).toBe(out));

  it('formatQuantity rejects more than 3 decimals', () => {
    expect(() => formatQuantity('1.2345', 'm')).toThrow();
  });

  it.each([
    ['+919876543210', '+91 98765 43210'],
    ['+14155550123', '+14155550123']
  ])('formatPhone(%s) = %s', (p, out) => expect(formatPhone(p)).toBe(out));

  it.each([
    ['event', 2026, 1, 'EVT-2026-0001'],
    ['event', 2026, 10000, 'EVT-2026-10000'],
    ['damage_report', 2026, 1, 'DMG-2026-00001'],
    ['count_session', 2026, 7, 'CNT-2026-0007'],
    ['stock_transfer', 2026, 1, 'TRF-2026-0001'],
    ['item', 0, 1, 'ITM-00001']
  ] as const)('formatRecordNumber(%s, %i, %i) = %s', (kind, year, n, out) =>
    expect(formatRecordNumber(kind, year, n)).toBe(out)
  );
});
