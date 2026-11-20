'use client';
import { useState } from 'react';
import { REPORTS, t, type ReportId } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

export default function ScheduleForm({ admins }: { admins: Array<{ id: string; label: string }> }) {
  const [f, setF] = useState({ reportId: 'R5' as ReportId, name: '', frequency: 'daily', weekday: '1', monthDay: '1', timeIst: '09:00' });
  const [recipients, setRecipients] = useState<string[]>([]);
  return (
    <ActionForm title={t('rpt.newSchedule')} submit={t('rpt.newSchedule')} onSubmit={() => api.post('/api/v1/report-schedules', {
      reportId: f.reportId, name: f.name || REPORTS[f.reportId].title, frequency: f.frequency, timeIst: f.timeIst, recipientIds: recipients,
      ...(f.frequency === 'weekly' ? { weekday: Number(f.weekday) } : {}), ...(f.frequency === 'monthly' ? { monthDay: Number(f.monthDay) } : {})
    }).then(() => undefined)}>
      <label htmlFor="rs-report">{t('rpt.report')}</label>
      <select id="rs-report" value={f.reportId} onChange={(e) => setF({ ...f, reportId: e.target.value as ReportId })}>
        {Object.values(REPORTS).map((r) => <option key={r.id} value={r.id}>{`${r.id} · ${r.title}`}</option>)}
      </select>
      <label htmlFor="rs-name">{t('rpt.name')}</label>
      <input id="rs-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label htmlFor="rs-freq">{t('rpt.frequency')}</label>
      <select id="rs-freq" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>
        {(['daily', 'weekly', 'monthly'] as const).map((x) => <option key={x} value={x}>{t(`rpt.freq.${x}`)}</option>)}
      </select>
      {f.frequency === 'weekly' ? <><label htmlFor="rs-wd">{t('rpt.weekday')}</label><input id="rs-wd" inputMode="numeric" value={f.weekday} onChange={(e) => setF({ ...f, weekday: e.target.value })} /></> : null}
      {f.frequency === 'monthly' ? <><label htmlFor="rs-md">{t('rpt.monthDay')}</label><input id="rs-md" inputMode="numeric" value={f.monthDay} onChange={(e) => setF({ ...f, monthDay: e.target.value })} /></> : null}
      <label htmlFor="rs-time">{t('rpt.time')}</label>
      <input id="rs-time" type="time" value={f.timeIst} onChange={(e) => setF({ ...f, timeIst: e.target.value })} />
      <fieldset>
        <legend>{t('rpt.recipients')}</legend>
        {admins.map((a) => (
          <label key={a.id} style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={recipients.includes(a.id)} style={{ width: 20, minHeight: 20 }}
              onChange={() => setRecipients(recipients.includes(a.id) ? recipients.filter((x) => x !== a.id) : [...recipients, a.id])} />
            {a.label}
          </label>
        ))}
      </fieldset>
    </ActionForm>
  );
}
