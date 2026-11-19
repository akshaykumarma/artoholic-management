import { describe, it, expect } from 'vitest';
import { convertQuantity, isQuantity, toQty, qtyCompare } from '../src/inventory/quantity';

describe('quantity math (no floating point)', () => {
  it('validates decimal strings, counted items whole only', () => {
    expect(isQuantity('12.5')).toBe(true);
    expect(isQuantity('12.3456')).toBe(false);
    expect(isQuantity('3', { counted: true })).toBe(true);
    expect(isQuantity('3.5', { counted: true })).toBe(false);
    expect(isQuantity('-2', { signed: true })).toBe(true);
  });
  it('converts within a family exactly', () => {
    expect(convertQuantity('150', '0.01', '1')).toBe('1.500'); // cm → m
    expect(convertQuantity('0.1', '1', '0.01')).toBe('10.000');
    expect(convertQuantity('10', '0.3048', '1')).toBe('3.048'); // ft → m
  });
  it('adds like money: 0.1 + 0.2 = 0.3', () => {
    expect(toQty('0.1').length).toBe(5);
    expect(qtyCompare('0.300', toQty(0.3))).toBe(0);
  });
});
