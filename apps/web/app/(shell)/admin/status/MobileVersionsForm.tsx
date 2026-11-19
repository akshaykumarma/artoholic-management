'use client';
import { useState, type FormEvent } from 'react';
import { mobileVersionSettingSchema, t, type MobileVersionSetting } from '@artoholic/shared';
import { api } from '@/lib/api';

function PlatformForm({ initial }: { initial: MobileVersionSetting }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const id = (f: string) => `${initial.platform}-${f}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const saved = await api.put(`/api/v1/admin/mobile-versions/${v.platform}`, {
        minimumVersion: v.minimumVersion,
        recommendedVersion: v.recommendedVersion,
        storeUrl: v.storeUrl
      }, mobileVersionSettingSchema);
      setV(saved);
      setMsg(t('versions.saved'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('error.INTERNAL'));
    }
  }

  return (
    <form onSubmit={save} aria-label={initial.platform}>
      <h3>{initial.platform === 'android' ? 'Android' : 'iOS'}</h3>
      <label htmlFor={id('min')}>{t('versions.minimum')}</label>
      <input id={id('min')} value={v.minimumVersion} onChange={(e) => setV({ ...v, minimumVersion: e.target.value })} />
      <label htmlFor={id('rec')}>{t('versions.recommended')}</label>
      <input id={id('rec')} value={v.recommendedVersion} onChange={(e) => setV({ ...v, recommendedVersion: e.target.value })} />
      <label htmlFor={id('url')}>{t('versions.storeUrl')}</label>
      <input id={id('url')} value={v.storeUrl} onChange={(e) => setV({ ...v, storeUrl: e.target.value })} />
      <button type="submit">{t('versions.save')}</button>
      {msg ? <p role="status">{msg}</p> : null}
    </form>
  );
}

export default function MobileVersionsForm({ initial }: { initial: MobileVersionSetting[] }) {
  return (
    <section className="card">
      <h2>{t('versions.title')}</h2>
      {initial.map((s) => (
        <PlatformForm key={s.platform} initial={s} />
      ))}
    </section>
  );
}
