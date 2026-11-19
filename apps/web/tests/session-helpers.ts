import type { Role } from '@artoholic/shared';
import { POST as signIn } from '../app/api/v1/auth/sign-in/route';
import { createUser, type TestUser } from './helpers';
import { makeReq, setCookies } from './request';

export interface WebSession {
  user: TestUser;
  cookies: Record<string, string>;
  /** Options to spread into makeReq for an authenticated web call. */
  as: { cookies: Record<string, string>; csrf: string };
}

export async function webSessionFor(roles: Role[], opts: Parameters<typeof createUser>[0] = {}): Promise<WebSession> {
  const user = await createUser({ ...opts, roles });
  const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { identifier: user.username, password: user.password } }));
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  const cookies = setCookies(res);
  return { user, cookies, as: { cookies, csrf: cookies.csrf! } };
}

export async function mobileTokenFor(identifier: string, password: string, platform: 'android' | 'ios' = 'android'): Promise<string> {
  const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform, body: { identifier, password } }));
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}
