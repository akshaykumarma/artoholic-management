'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import NavIcon from './NavIcon';

/** Main menu links; the current section is highlighted. */
export default function NavLinks({ items, badges }: { items: { moduleId: string; path: string; label: string }[]; badges?: Record<string, ReactNode> }) {
  const pathname = usePathname() ?? '/';
  const current = items
    .filter((m) => (m.path === '/' ? pathname === '/' : pathname === m.path || pathname.startsWith(`${m.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]?.moduleId;
  return (
    <ul>
      {items.map((m) => (
        <li key={m.moduleId}>
          <Link href={m.path} aria-current={m.moduleId === current ? 'page' : undefined}>
            <NavIcon id={m.moduleId} />
            <span>{m.label}</span>
          </Link>
          {badges?.[m.moduleId]}
        </li>
      ))}
    </ul>
  );
}
