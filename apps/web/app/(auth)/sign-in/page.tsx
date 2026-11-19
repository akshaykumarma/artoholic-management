import { Suspense } from 'react';
import SignInForm from './SignInForm';

export default function SignInPage() {
  return (
    <main className="auth">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
