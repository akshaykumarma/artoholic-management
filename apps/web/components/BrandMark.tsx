import { t } from '@artoholic/shared';

/**
 * Text wordmark in the logo's colours. Placeholder until the logo file is added to
 * apps/web/public/brand/ — then this renders the image instead.
 */
export default function BrandMark({ withTagline = true }: { withTagline?: boolean }) {
  return (
    <div>
      <div className="brand" aria-label={t('app.name')}>
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">{t('app.name')}</span>
      </div>
      {withTagline ? <p className="tagline">{t('app.tagline')}</p> : null}
    </div>
  );
}
