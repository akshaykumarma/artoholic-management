import type { Role, User } from '@artoholic/shared';

export interface UserRow {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  username: string;
  status: 'active' | 'deactivated';
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
  roles: Role[] | null;
  warehouse_ids: string[] | null;
}

export const USER_SELECT = `
  SELECT u.id, u.full_name, u.phone_e164, u.email, u.username, u.status, u.must_change_password, u.created_at, u.updated_at,
         (SELECT array_agg(r.role::text ORDER BY r.role) FROM user_roles r WHERE r.user_id = u.id) AS roles,
         (SELECT array_agg(w.warehouse_id ORDER BY w.assigned_at) FROM warehouse_assignments w WHERE w.user_id = u.id AND w.unassigned_at IS NULL) AS warehouse_ids
    FROM users u`;

export function toUser(r: UserRow): User {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone_e164,
    email: r.email,
    username: r.username,
    roles: r.roles ?? [],
    warehouseIds: r.warehouse_ids ?? [],
    status: r.status,
    mustChangePassword: r.must_change_password,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString()
  };
}
