'use client';
import { useState } from 'react';
import { DELIVERY_CHANNELS, NOTIFICATION_GROUPS, t, type MessageKey, type Preferences } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

/** Channels per group (in-app is always on) and quiet hours (US3). */
export default function PreferencesForm({ initial }: { initial: Preferences }) {
  const [p, setP] = useState(initial);
  const flip = (g: string, c: string) => setP({ ...p, groups: { ...p.groups, [g]: { ...p.groups[g as keyof Preferences['groups']]!, [c]: !p.groups[g as keyof Preferences['groups']]![c as 'push'] } } });
  return (
    <ActionForm submit={t('ntf.save')} success={t('ntf.saved')} onSubmit={() => api.put('/api/v1/me/notification-preferences', p).then(() => undefined)}>
      <table>
        <thead><tr><th />{DELIVERY_CHANNELS.map((c) => <th key={c}>{t(`ntf.channel.${c}` as MessageKey)}</th>)}</tr></thead>
        <tbody>
          {NOTIFICATION_GROUPS.filter((g) => g !== 'account').map((g) => (
            <tr key={g}>
              <td>{t(`ntf.group.${g}` as MessageKey)}</td>
              {DELIVERY_CHANNELS.map((c) => (
                <td key={c}>
                  <input type="checkbox" aria-label={`${t(`ntf.group.${g}` as MessageKey)} · ${t(`ntf.channel.${c}` as MessageKey)}`} style={{ width: 20, minHeight: 20 }}
                    checked={!!p.groups[g]?.[c]} onChange={() => flip(g, c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={p.quietHours.enabled} onChange={(e) => setP({ ...p, quietHours: { ...p.quietHours, enabled: e.target.checked } })} style={{ width: 20, minHeight: 20 }} />
        {t('ntf.quiet')}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <div><label htmlFor="q-from">{t('ntf.quietFrom')}</label><input id="q-from" type="time" value={p.quietHours.start} onChange={(e) => setP({ ...p, quietHours: { ...p.quietHours, start: e.target.value } })} /></div>
        <div><label htmlFor="q-to">{t('ntf.quietTo')}</label><input id="q-to" type="time" value={p.quietHours.end} onChange={(e) => setP({ ...p, quietHours: { ...p.quietHours, end: e.target.value } })} /></div>
      </div>
    </ActionForm>
  );
}
