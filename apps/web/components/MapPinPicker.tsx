'use client';
import { t } from '@artoholic/shared';

/**
 * Map pin (004 T001). Until a Places key is configured (MAPS_API_KEY_WEB), the pin is entered as
 * coordinates, with a link to check it on Google Maps; place search replaces the inputs later.
 */
export default function MapPinPicker({ lat, lng, onChange }: { lat: string; lng: string; onChange: (lat: string, lng: string) => void }) {
  const ok = lat !== '' && lng !== '' && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 120 }}>
        <label htmlFor="pin-lat">{t('wh.latitude')}</label>
        <input id="pin-lat" inputMode="decimal" value={lat} onChange={(e) => onChange(e.target.value, lng)} />
      </div>
      <div style={{ flex: 1, minWidth: 120 }}>
        <label htmlFor="pin-lng">{t('wh.longitude')}</label>
        <input id="pin-lng" inputMode="decimal" value={lng} onChange={(e) => onChange(lat, e.target.value)} />
      </div>
      {ok ? <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noreferrer">{t('wh.openMap')}</a> : null}
    </div>
  );
}
