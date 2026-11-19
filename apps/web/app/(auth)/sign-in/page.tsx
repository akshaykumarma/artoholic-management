import { Suspense } from 'react';
import SignInForm from './SignInForm';
import BrandMark from '@/components/BrandMark';

export default function SignInPage() {
  return (
    <main className="auth">
      <div>
      <BrandMark />
      <Suspense>
        <SignInForm />
      </Suspense>
      </div>
    </main>
  );
}
