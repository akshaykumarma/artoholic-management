import { Suspense } from 'react';
import { requirePageAuth } from '@/lib/server-auth';
import BrandMark from '@/components/BrandMark';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  await requirePageAuth();
  return (
    <main className="auth">
      <div>
        <BrandMark />
        <Suspense>
          <ChangePasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
