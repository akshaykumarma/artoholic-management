import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import EventForm from '@/components/EventForm';
import { eventFormOptions } from '../load-options';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'events.manage')) return <Forbidden />;
  return <EventForm {...await eventFormOptions()} />;
}
