'use client';
import { useState } from 'react';
import { t, TRIGGERS, type TemplateMapping } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Provider = { config: Record<string, string>; hasSecret: boolean };

function Inputs({ fields, config, set }: { fields: Array<[string, string]>; config: Record<string, string>; set: (c: Record<string, string>) => void }) {
  return (
    <>
      {fields.map(([k, label]) => (
        <div key={k}>
          <label htmlFor={`f-${k}`}>{label}</label>
          <input id={`f-${k}`} value={config[k] ?? ''} onChange={(e) => set({ ...config, [k]: e.target.value })} />
        </div>
      ))}
    </>
  );
}

/** Super Admin: providers (secrets write-only), template mappings and a test send (US4). */
export default function IntegrationForms({ whatsapp, email, templates }: { whatsapp: Provider; email: Provider; templates: TemplateMapping[] }) {
  const [wa, setWa] = useState(whatsapp.config);
  const [waSecret, setWaSecret] = useState('');
  const [em, setEm] = useState(email.config);
  const [emSecret, setEmSecret] = useState('');
  const [testTo, setTestTo] = useState('');
  const [tpl, setTpl] = useState<TemplateMapping>(templates[0] ?? { trigger: 'event.scheduled', channel: 'whatsapp', templateName: '', language: 'en', variables: [], bodyText: '' });
  const [vars, setVars] = useState(tpl.variables.join(', '));
  return (
    <>
      <ActionForm title={t('int.whatsapp')} submit={t('int.save')} onSubmit={() => api.put('/api/v1/admin/providers/whatsapp', { config: wa, secret: waSecret || undefined }).then(() => setWaSecret(''))}>
        <Inputs fields={[['provider', t('int.provider')], ['phoneNumberId', t('int.phoneNumberId')], ['verifyToken', t('int.verifyToken')]]} config={wa} set={setWa} />
        <label htmlFor="wa-secret">{t('int.waSecret')}</label>
        <input id="wa-secret" type="password" autoComplete="off" value={waSecret} onChange={(e) => setWaSecret(e.target.value)} />
        {whatsapp.hasSecret ? <p className="muted">{t('int.secretSet')}</p> : null}
      </ActionForm>
      <ActionForm title={t('int.email')} submit={t('int.save')} onSubmit={() => api.put('/api/v1/admin/providers/email', { config: em, secret: emSecret || undefined }).then(() => setEmSecret(''))}>
        <Inputs fields={[['host', t('int.host')], ['port', t('int.port')], ['user', t('int.user')], ['from', t('int.from')]]} config={em} set={setEm} />
        <label htmlFor="em-secret">{t('int.password')}</label>
        <input id="em-secret" type="password" autoComplete="off" value={emSecret} onChange={(e) => setEmSecret(e.target.value)} />
        {email.hasSecret ? <p className="muted">{t('int.secretSet')}</p> : null}
      </ActionForm>
      <ActionForm title={t('int.test')} submit={t('int.test')} onSubmit={async () => {
        const m = await api.post<{ status: string }>(`/api/v1/admin/providers/${testTo.includes('@') ? 'email' : 'whatsapp'}/test`, { to: testTo });
        return m.status;
      }}>
        <label htmlFor="test-to">{t('int.testTo')}</label>
        <input id="test-to" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
      </ActionForm>
      <ActionForm title={t('int.templates')} submit={t('int.saveTemplate')} onSubmit={() => api.put('/api/v1/admin/template-mappings', {
        items: [{ ...tpl, variables: vars.split(',').map((v) => v.trim()).filter(Boolean) }]
      }).then(() => undefined)}>
        <label htmlFor="tpl-trigger">{t('int.trigger')}</label>
        <select id="tpl-trigger" value={tpl.trigger} onChange={(e) => {
          const next = templates.find((x) => x.trigger === e.target.value && x.channel === tpl.channel) ?? { ...tpl, trigger: e.target.value, templateName: '', bodyText: '', variables: [] };
          setTpl(next);
          setVars(next.variables.join(', '));
        }}>
          {Object.keys(TRIGGERS).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <label htmlFor="tpl-channel">{t('msg.channel')}</label>
        <select id="tpl-channel" value={tpl.channel} onChange={(e) => setTpl({ ...tpl, channel: e.target.value as 'whatsapp' | 'email' })}>
          <option value="whatsapp">{t('ntf.channel.whatsapp')}</option>
          <option value="email">{t('ntf.channel.email')}</option>
        </select>
        <label htmlFor="tpl-name">{t('int.templateName')}</label>
        <input id="tpl-name" value={tpl.templateName} onChange={(e) => setTpl({ ...tpl, templateName: e.target.value })} />
        <label htmlFor="tpl-lang">{t('int.language')}</label>
        <input id="tpl-lang" value={tpl.language} onChange={(e) => setTpl({ ...tpl, language: e.target.value })} />
        <label htmlFor="tpl-vars">{t('int.variables')}</label>
        <input id="tpl-vars" value={vars} onChange={(e) => setVars(e.target.value)} />
        <label htmlFor="tpl-body">{t('int.bodyText')}</label>
        <textarea id="tpl-body" value={tpl.bodyText} onChange={(e) => setTpl({ ...tpl, bodyText: e.target.value })} />
      </ActionForm>
    </>
  );
}
