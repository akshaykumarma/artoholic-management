import type { ReactNode } from 'react';
import Link from 'next/link';
import { buildMenu, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import SignOutButton from '@/components/SignOutButton';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const auth = await requirePageAuth();
  const menu = buildMenu(auth.user.roles, 'web');
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <h1>{t('app.name')}</h1>
        <ul>
          {menu.map((m) => (
            <li key={m.moduleId}>
              <Link href={m.path}>{t(m.labelKey)}</Link>
            </li>
          ))}
        </ul>
        <SignOutButton />
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
