'use client';
import { useState } from 'react';
import { t, type WarehouseDetail } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';
import MapPinPicker from '@/components/MapPinPicker';

export default function WarehouseSettings({ warehouse, managers }: { warehouse: WarehouseDetail; managers: Array<{ id: string; fullName: string }> }) {
  const [name, setName] = useState(warehouse.name);
  const [address, setAddress] = useState(warehouse.address);
  const [lat, setLat] = useState(warehouse.latitude === null ? '' : String(warehouse.latitude));
  const [lng, setLng] = useState(warehouse.longitude === null ? '' : String(warehouse.longitude));
  const [phone, setPhone] = useState(warehouse.contactPhone ?? '');
  const [levels, setLevels] = useState(warehouse.levels.join(', '));
  const [sms, setSms] = useState<string[]>(warehouse.storeManagers.map((s) => s.id));
  const toggle = (id: string) => setSms((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  async function save() {
    const lv = levels.split(',').map((s) => s.trim()).filter(Boolean);
    await api.patch(`/api/v1/warehouses/${warehouse.id}`, {
      name, address, contactPhone: phone || null, latitude: lat === '' ? null : Number(lat), longitude: lng === '' ? null : Number(lng), storeManagerIds: sms, ...(lv.length ? { levels: lv } : {})
    });
  }
  return (
    <ActionForm title={t('wh.save')} submit={t('wh.save')} onSubmit={save}>
      <label htmlFor="wh-name">{t('wh.name')}</label>
      <input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="wh-address">{t('wh.address')}</label>
      <input id="wh-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <MapPinPicker lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />
      <label htmlFor="wh-phone">{t('wh.contact')}</label>
      <input id="wh-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label htmlFor="wh-levels">{t('wh.levels')}</label>
      <input id="wh-levels" value={levels} onChange={(e) => setLevels(e.target.value)} />
      {warehouse.binCount ? <p className="muted">{t('wh.layoutLocked')}</p> : null}
      <fieldset>
        <legend>{t('wh.storeManagers')}</legend>
        {managers.map((m) => (
          <label key={m.id} style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={sms.includes(m.id)} onChange={() => toggle(m.id)} style={{ width: 20, minHeight: 20 }} />
            {m.fullName}
          </label>
        ))}
      </fieldset>
    </ActionForm>
  );
}
