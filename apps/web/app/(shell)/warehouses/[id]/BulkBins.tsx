'use client';
import { useState } from 'react';
import { t, type Range } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

/** "A-C" → from/to, "1-10" → numeric from/to, "X,Y" → list. */
export function parseRange(text: string): Range {
  const s = text.trim().toUpperCase();
  if (s.includes(',')) return { list: s.split(',').map((x) => x.trim()).filter(Boolean) };
  const [a, b = a] = s.split('-').map((x) => x.trim());
  const num = (x: string) => (/^\d+$/.test(x) ? Number(x) : x);
  return { from: num(a ?? ''), to: num(b ?? '') };
}

export default function BulkBins({ warehouseId, levels }: { warehouseId: string; levels: string[] }) {
  const [ranges, setRanges] = useState<string[]>(levels.map(() => ''));
  const [preview, setPreview] = useState<{ create: number; skip: string[] } | null>(null);
  const body = () => ({ ranges: ranges.map(parseRange) });
  async function run() {
    if (!preview) {
      const p = await api.post<{ create: number; skip: string[] }>(`/api/v1/warehouses/${warehouseId}/locations/bulk/preview`, body());
      setPreview(p);
      return t('wh.willCreate', { create: p.create, skip: p.skip.length });
    }
    const r = await api.post<{ created: string[] }>(`/api/v1/warehouses/${warehouseId}/locations/bulk`, body());
    setPreview(null);
    return t('wh.created', { n: r.created.length });
  }
  return (
    <ActionForm title={t('wh.bulk')} submit={preview ? t('wh.create', { n: preview.create }) : t('wh.preview')} onSubmit={run}>
      <p className="muted">{t('wh.bulkHint')}</p>
      {levels.map((name, i) => (
        <div key={name + i}>
          <label htmlFor={`range-${i}`}>{name}</label>
          <input id={`range-${i}`} value={ranges[i]} onChange={(e) => { setPreview(null); setRanges((r) => r.map((x, j) => (j === i ? e.target.value : x))); }} />
        </div>
      ))}
    </ActionForm>
  );
}
