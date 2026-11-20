import type { ReactNode } from 'react';
import { t } from '@artoholic/shared';

/** Console pages are made for a computer; on a phone they show a notice but still work (010 edge case). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{'.phone-notice{display:none}@media (max-width:700px){.phone-notice{display:block}}'}</style>
      <p className="phone-notice card muted" role="note">{t('adm.phoneNotice')}</p>
      {children}
    </>
  );
}
