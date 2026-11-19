import { buildMenu, type ClientPlatform, type Me } from '@artoholic/shared';
import type { Authenticated } from './sessions';

export function buildMe(auth: Authenticated, platform: ClientPlatform): Me {
  return {
    id: auth.user.id,
    fullName: auth.user.fullName,
    username: auth.user.username,
    roles: auth.user.roles,
    menu: buildMenu(auth.user.roles, platform),
    mustChangePassword: auth.user.mustChangePassword,
    session: { expiresAt: auth.session.expiresAt.toISOString(), idleTimeoutMinutes: auth.session.idleTimeoutMinutes }
  };
}
