import type { ReactNode } from 'react';
import { t } from '@artoholic/shared';
import './globals.css';

export const metadata = { title: t('app.name') };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
