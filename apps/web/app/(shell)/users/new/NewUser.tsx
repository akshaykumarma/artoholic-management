'use client';
import { useRouter } from 'next/navigation';
import UserForm from '@/components/UserForm';

export default function NewUser({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  return <UserForm isSuperAdmin={isSuperAdmin} onSaved={(u) => router.push(`/users/${u.id}`)} />;
}
