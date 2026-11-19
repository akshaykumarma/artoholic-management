'use client';
import { useState, type FormEvent } from 'react';
import { ApiClientError, ROLES, t, userSchema, type MessageKey, type Role, type User } from '@artoholic/shared';
import { api } from '@/lib/api';

/** Create (no `user`) or edit a user. Admin and Super Admin roles are offered only to the Super Admin. */
export default function UserForm({ user, isSuperAdmin, onSaved }: { user?: User; isSuperAdmin: boolean; onSaved: (u: User) => void }) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [temporaryPassword, setTemp] = useState('');
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? []);
  const [error, setError] = useState<string | null>(null);
  const offered = ROLES.filter((r) => r !== 'super_admin' && (r !== 'admin' || isSuperAdmin));

  function toggle(r: Role) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const saved = user
        ? await api.request('PATCH', `/api/v1/users/${user.id}`, { body: { fullName, phone, email: email || null, username, roles }, schema: userSchema, headers: { 'if-match': user.updatedAt } })
        : await api.post('/api/v1/users', { fullName, phone, email, username, temporaryPassword, roles }, userSchema);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'PASSWORD_POLICY') {
        setError(((err.details?.rules as string[]) ?? []).map((r) => t(`password.rule.${r}` as MessageKey)).join(' · '));
      } else if (err instanceof ApiClientError && err.code === 'VALIDATION_FAILED') {
        setError(Object.values((err.details?.fields as Record<string, string>) ?? {}).join(' · ') || err.message);
      } else setError(err instanceof Error ? err.message : t('error.INTERNAL'));
    }
  }

  return (
    <form onSubmit={submit} aria-label={user ? t('users.edit') : t('users.new')}>
      <label htmlFor="fullName">{t('users.fullName')}</label>
      <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <label htmlFor="phone">{t('users.phone')}</label>
      <input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label htmlFor="email">{t('users.email')}</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="username">{t('users.username')}</label>
      <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      {user ? null : (
        <>
          <label htmlFor="temp">{t('users.tempPassword')}</label>
          <input id="temp" type="text" autoComplete="off" value={temporaryPassword} onChange={(e) => setTemp(e.target.value)} />
        </>
      )}
      <fieldset style={{ border: 0, padding: 0, marginTop: 12 }}>
        <legend style={{ fontWeight: 600 }}>{t('users.roles')}</legend>
        {offered.map((r) => (
          <label key={r} style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={roles.includes(r)} onChange={() => toggle(r)} />
            {t(`role.${r}`)}
          </label>
        ))}
      </fieldset>
      <button type="submit">{user ? t('users.save') : t('users.create')}</button>
      {error ? <p role="alert" className="error">{error}</p> : null}
    </form>
  );
}
