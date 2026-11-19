'use client';
import { useState } from 'react';
import { FREQUENCIES, t, type MessageKey } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Opt = { id: string; label: string };
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** New schedule (US1) or an ad-hoc count started now (US2): scope, counters, blind flag. */
export default function ScopeForm({ mode, warehouses, categories, managers }: { mode: 'schedule' | 'adhoc'; warehouses: Opt[]; categories: Opt[]; managers: Opt[] }) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [startDate, setStartDate] = useState('');
  const [wh, setWh] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [blind, setBlind] = useState(true);
  const boxes = (legend: string, opts: Opt[], chosen: string[], set: (v: string[]) => void) => (
    <fieldset>
      <legend>{legend}</legend>
      {opts.map((o) => (
        <label key={o.id} style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={chosen.includes(o.id)} onChange={() => set(toggle(chosen, o.id))} style={{ width: 20, minHeight: 20 }} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
  const body = { scope: { warehouseIds: wh, categoryIds: cats }, assigneeIds: people, blind };
  return (
    <ActionForm title={mode === 'schedule' ? t('cnt.newSchedule') : t('cnt.adHoc')} submit={mode === 'schedule' ? t('cnt.newSchedule') : t('cnt.adHoc')}
      onSubmit={() => (mode === 'schedule' ? api.post('/api/v1/counts/schedules', { ...body, name, frequency, startDate }) : api.post('/api/v1/counts/sessions', body)).then(() => undefined)}>
      {mode === 'schedule' ? (
        <>
          <label htmlFor="cs-name">{t('cnt.name')}</label>
          <input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="cs-freq">{t('cnt.frequency')}</label>
          <select id="cs-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`cnt.freq.${f}` as MessageKey)}</option>)}
          </select>
          <label htmlFor="cs-start">{t('cnt.startDate')}</label>
          <input id="cs-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </>
      ) : null}
      {boxes(t('cnt.warehouses'), warehouses, wh, setWh)}
      {boxes(t('cnt.categories'), categories, cats, setCats)}
      {boxes(t('cnt.assignees'), managers, people, setPeople)}
      <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
        {t('cnt.blind')}
      </label>
    </ActionForm>
  );
}
