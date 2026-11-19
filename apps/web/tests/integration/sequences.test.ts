import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPool, withTransaction } from '../../db/client';
import { issueRecordNumber } from '../../server/sequences/issue';

afterEach(() => vi.useRealTimers());

describe('issueRecordNumber (FR-014, SC-007)', () => {
  it('formats the first event of the year', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
    const n = await withTransaction((tx) => issueRecordNumber(tx, 'event'));
    expect(n).toBe('EVT-2026-0001');
  });

  it('1,000 concurrent issues give 1,000 distinct consecutive numbers', async () => {
    getPool().options.max = 20;
    const results = await Promise.all(Array.from({ length: 1000 }, () => withTransaction((tx) => issueRecordNumber(tx, 'damage_report'))));
    const nums = results.map((r) => Number(r.split('-').at(-1))).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(1000);
    expect(nums[0]).toBe(1);
    expect(nums.at(-1)).toBe(1000);
  });

  it('a rolled-back transaction gives its number back (no gap, no reuse of committed numbers)', async () => {
    await withTransaction((tx) => issueRecordNumber(tx, 'event'));
    await expect(
      withTransaction(async (tx) => {
        await issueRecordNumber(tx, 'event');
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    const third = await withTransaction((tx) => issueRecordNumber(tx, 'event'));
    expect(third.endsWith('-0002')).toBe(true);
  });

  it('restarts at 0001 in the next IST year, decided by IST not UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T18:29:00Z')); // 23:59 IST on 31 Dec 2026
    expect(await withTransaction((tx) => issueRecordNumber(tx, 'event'))).toBe('EVT-2026-0001');
    vi.setSystemTime(new Date('2026-12-31T19:00:00Z')); // 00:30 IST on 1 Jan 2027
    expect(await withTransaction((tx) => issueRecordNumber(tx, 'event'))).toBe('EVT-2027-0001');
  });

  it('item codes are not numbered by year', async () => {
    expect(await withTransaction((tx) => issueRecordNumber(tx, 'item'))).toBe('ITM-00001');
  });
});
