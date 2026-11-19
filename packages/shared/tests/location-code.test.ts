import { describe, it, expect } from 'vitest';
import { expandBins, expandRange, locationCode } from '../src/warehouses/location-code';

describe('location codes (004 US2)', () => {
  it('A × 1–3 × 1–2 gives 6 bins in walking order', () => {
    const bins = expandBins([{ from: 'A', to: 'A' }, { from: 1, to: 3 }, { from: 1, to: 2 }]).map((p) => locationCode('MAIN', p));
    expect(bins).toEqual(['MAIN-A-01-01', 'MAIN-A-01-02', 'MAIN-A-02-01', 'MAIN-A-02-02', 'MAIN-A-03-01', 'MAIN-A-03-02']);
  });
  it('pads numbers to the widest in the range', () => {
    expect(expandRange({ from: 1, to: 10 })).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
    expect(expandRange({ from: 3, to: 3 })).toEqual(['03']);
    expect(expandRange({ from: 1, to: 120 })[0]).toBe('001');
  });
  it('letters and lists', () => {
    expect(expandRange({ from: 'A', to: 'D' })).toEqual(['A', 'B', 'C', 'D']);
    expect(expandRange({ list: ['cold', 'Dry'] })).toEqual(['COLD', 'DRY']);
  });
  it('refuses mixed or backwards ranges', () => {
    expect(() => expandRange({ from: 'A', to: 3 })).toThrow();
    expect(() => expandRange({ from: 5, to: 2 })).toThrow();
  });
});
