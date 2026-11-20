import { t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getCompanyProfile } from '@/server/admin/settings';
import ProfileForm from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  return <section className="card"><h2>{t('adm.profile')}</h2><ProfileForm initial={await getCompanyProfile()} /></section>;
}
