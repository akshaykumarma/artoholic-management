'use client';
import { useState } from 'react';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Profile = { name: string; tagline: string; logoKey: string | null; gstin: string | null; address: string; phone: string | null; email: string | null };

export default function ProfileForm({ initial }: { initial: Profile }) {
  const [p, setP] = useState({ ...initial, gstin: initial.gstin ?? '', phone: initial.phone ?? '', email: initial.email ?? '' });
  const [logo, setLogo] = useState<File | null>(null);
  async function save() {
    let logoKey: string | undefined;
    if (logo) {
      const type = logo.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const { url, key } = await api.post<{ url: string; key: string }>('/api/v1/photos/upload-url', { purpose: 'logo', contentType: type });
      const put = await fetch(url, { method: 'PUT', body: logo, headers: { 'content-type': type } });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      logoKey = key;
    }
    await api.put('/api/v1/admin/company-profile', { name: p.name, tagline: p.tagline, address: p.address, gstin: p.gstin || null, phone: p.phone || null, email: p.email || '', ...(logoKey ? { logoKey } : {}) });
  }
  const field = (k: 'name' | 'tagline' | 'gstin' | 'address' | 'phone' | 'email', label: string) => (
    <><label htmlFor={`p-${k}`}>{label}</label><input id={`p-${k}`} value={p[k] ?? ''} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></>
  );
  return (
    <ActionForm submit={t('adm.saveProfile')} onSubmit={save}>
      {field('name', t('adm.companyName'))}{field('tagline', t('adm.tagline'))}{field('gstin', t('adm.gstin'))}{field('address', t('adm.address'))}{field('phone', t('adm.phone'))}{field('email', t('adm.email'))}
      <label htmlFor="p-logo">{t('adm.logo')}</label>
      <input id="p-logo" type="file" accept="image/png,image/jpeg" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
    </ActionForm>
  );
}
