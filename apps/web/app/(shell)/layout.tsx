import type { ReactNode } from 'react';
import { buildMenu, t } from '@artoholic/shared';
import { redirect } from 'next/navigation';
import { requirePageAuth } from '@/lib/server-auth';
import SignOutButton from '@/components/SignOutButton';
import BrandMark from '@/components/BrandMark';
import UnreadBadge from '@/components/UnreadBadge';
import NavLinks from '@/components/NavLinks';
import { unreadCount } from '@/server/notifications/centre';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const auth = await requirePageAuth();
  if (auth.user.mustChangePassword) redirect('/change-password');
  const menu = buildMenu(auth.user.roles, 'web');
  const unread = await unreadCount(auth);
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <BrandMark />
        <NavLinks
          items={menu.map((m) => ({ moduleId: m.moduleId, path: m.path, label: t(m.labelKey) }))}
          badges={{ notifications: <UnreadBadge initial={unread} /> }}
        />
        <SignOutButton />
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
