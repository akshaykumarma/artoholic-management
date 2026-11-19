import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ApiClientError, formatPhone, ROLES, t, userListSchema, userSchema, type MessageKey, type Role, type User } from '@artoholic/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Message, ui } from './ui';

const errorText = (err: unknown) => {
  if (err instanceof ApiClientError && err.code === 'PASSWORD_POLICY') {
    return ((err.details?.rules as string[]) ?? []).map((r) => t(`password.rule.${r}` as MessageKey)).join(' · ');
  }
  if (err instanceof ApiClientError && err.code === 'VALIDATION_FAILED') {
    return Object.values((err.details?.fields as Record<string, string>) ?? {}).join(' · ') || err.message;
  }
  return err instanceof Error ? err.message : t('error.INTERNAL');
};

/** Users list with search (002 FR-015). */
export function UsersListScreen({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<User[]>([]);
  const load = useCallback(async () => {
    const res = await api.get(`/api/v1/users?q=${encodeURIComponent(q)}`, userListSchema);
    setItems(res.items);
  }, [api, q]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{t('users.title')}</Text>
      <Button label={t('users.new')} onPress={onNew} secondary />
      <Field label={t('users.search')} value={q} onChangeText={setQ} />
      {items.length === 0 ? <Text style={ui.muted}>{t('users.empty')}</Text> : null}
      {items.map((u) => (
        <Pressable key={u.id} accessibilityRole="button" style={ui.row} onPress={() => onOpen(u.id)}>
          <Text style={{ fontWeight: '600' }}>{u.fullName}</Text>
          <Text style={ui.muted}>{[u.phone ? formatPhone(u.phone) : null, u.roles.map((r) => t(`role.${r}`)).join(', '), t(`users.status.${u.status}`)].filter(Boolean).join(' · ')}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function RolePicker({ value, onChange, isSuperAdmin }: { value: Role[]; onChange: (r: Role[]) => void; isSuperAdmin: boolean }) {
  return (
    <View>
      <Text style={ui.label}>{t('users.roles')}</Text>
      {ROLES.filter((r) => r !== 'super_admin' && (r !== 'admin' || isSuperAdmin)).map((r) => {
        const on = value.includes(r);
        return (
          <Pressable key={r} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={ui.row}
            onPress={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}>
            <Text>{`${on ? '☑' : '☐'}  ${t(`role.${r}`)}`}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Create a user (002 US1) or edit one (US6). */
export function UserFormScreen({ user, onSaved }: { user?: User; onSaved: (u: User) => void }) {
  const { api, me } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [temp, setTemp] = useState('');
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = user
        ? await api.request('PATCH', `/api/v1/users/${user.id}`, { body: { fullName, phone, email: email || null, username, roles }, headers: { 'if-match': user.updatedAt }, schema: userSchema })
        : await api.post('/api/v1/users', { fullName, phone, email, username, temporaryPassword: temp, roles }, userSchema);
      onSaved(saved);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{user ? t('users.edit') : t('users.new')}</Text>
      <Field label={t('users.fullName')} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Field label={t('users.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={t('users.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label={t('users.username')} value={username} onChangeText={setUsername} />
      {user ? null : <Field label={t('users.tempPassword')} value={temp} onChangeText={setTemp} />}
      <RolePicker value={roles} onChange={setRoles} isSuperAdmin={me?.roles.includes('super_admin') ?? false} />
      <Button label={user ? t('users.save') : t('users.create')} busy={busy} onPress={save} />
      {error ? <Message error>{error}</Message> : null}
    </ScrollView>
  );
}

/** Detail with deactivate / reactivate / temporary password (002 US4, US6). */
export function UserDetailScreen({ id, onEdit }: { id: string; onEdit: (u: User) => void }) {
  const { api, me } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const [temp, setTemp] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const load = useCallback(async () => setUser(await api.get(`/api/v1/users/${id}`, userSchema)), [api, id]);
  useEffect(() => {
    void load().catch((err) => setMsg({ text: errorText(err), error: true }));
  }, [load]);

  async function run(path: string, body: object) {
    setMsg(null);
    try {
      await api.post(path, body);
      await load();
      setMsg({ text: t('versions.saved') });
    } catch (err) {
      setMsg({ text: errorText(err), error: true });
    }
  }

  if (!user) return msg ? <Message error>{msg.text}</Message> : null;
  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Text style={ui.title}>{user.fullName}</Text>
      <Text style={ui.muted}>{[user.username, user.phone ? formatPhone(user.phone) : null, t(`users.status.${user.status}`)].filter(Boolean).join(' · ')}</Text>
      {user.mustChangePassword ? <Text>{t('users.mustChange')}</Text> : null}
      <Button label={t('users.edit')} secondary onPress={() => onEdit(user)} />
      <Field label={t('users.tempPassword')} value={temp} onChangeText={setTemp} />
      {user.status === 'active' ? (
        <>
          <Button label={t('users.setTempPassword')} secondary onPress={() => run(`/api/v1/users/${id}/temporary-password`, { temporaryPassword: temp })} />
          {me?.id === user.id ? null : (
            <>
              <Field label={t('users.deactivateReason')} value={reason} onChangeText={setReason} />
              <Button label={t('users.deactivate')} onPress={() => run(`/api/v1/users/${id}/deactivate`, { reason })} />
            </>
          )}
        </>
      ) : (
        <Button label={t('users.reactivate')} onPress={() => run(`/api/v1/users/${id}/reactivate`, { temporaryPassword: temp })} />
      )}
      {msg ? <Message error={msg.error}>{msg.text}</Message> : null}
    </ScrollView>
  );
}
