/** Event lifecycle (005 FR-009). 005 moves Draft/Scheduled/Cancelled; 006 drives the rest. */
export const EVENT_STATUSES = ['draft', 'scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling', 'closed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

const NEXT: Record<EventStatus, readonly EventStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['dispatching', 'cancelled'],
  dispatching: ['in_transit'],
  in_transit: ['at_site'],
  at_site: ['returning'],
  returning: ['reconciling'],
  reconciling: ['closed'],
  closed: [],
  cancelled: []
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return NEXT[from].includes(to);
}

/** Statuses that hold or will hold stock: they count against availability. */
export const COMMITTED_STATUSES: readonly EventStatus[] = ['scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling'];

/** Before dispatch, everything about an event can still change. */
export function isEditable(status: EventStatus): boolean {
  return status === 'draft' || status === 'scheduled';
}
