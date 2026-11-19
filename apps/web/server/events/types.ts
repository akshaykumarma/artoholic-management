import { getPool } from '../../db/client';
import { ApiError } from '../http/errors';

/** Admin-editable event types (005 edge case); written by the Super Admin. */
export async function createEventType(name: string) {
  try {
    const { rows } = await getPool().query<{ id: string; name: string; status: 'active' | 'archived' }>(
      "INSERT INTO event_types (name, position) VALUES ($1, (SELECT COALESCE(max(position), 0) + 1 FROM event_types)) RETURNING id, name, status", [name]
    );
    return rows[0]!;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new ApiError('CODE_TAKEN', { name }, `${name} already exists.`);
    throw e;
  }
}

export async function updateEventType(id: string, input: { name: string; status?: 'active' | 'archived' }) {
  const { rows } = await getPool().query<{ id: string; name: string; status: 'active' | 'archived' }>(
    'UPDATE event_types SET name = $2, status = COALESCE($3::item_status, status) WHERE id = $1 RETURNING id, name, status', [id, input.name, input.status ?? null]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return rows[0];
}
