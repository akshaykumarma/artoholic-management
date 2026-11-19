import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import EventForm from '@/components/EventForm';
import { getEvent } from '@/server/events/events';
import { eventFormOptions } from '../../load-options';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.manage')) return <Forbidden />;
  const event = await getEvent(auth, params.id).catch(() => null);
  if (!event) return <Forbidden />;
  return <EventForm event={event} {...await eventFormOptions()} />;
}
