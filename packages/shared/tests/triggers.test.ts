import { describe, it, expect } from 'vitest';
import { renderNotification, TRIGGERS } from '../src/notifications/triggers';

describe('notification catalogue (008)', () => {
  it('renders a title, summary and deep link with IST times', () => {
    const r = renderNotification('event.scheduled', { eventId: 'e1', number: 'EVT-2026-0001', name: 'Sangeet', leaveWarehouseAt: '2026-12-01T03:30:00.000Z', link: '/events/e1' });
    expect(r).toEqual({ title: 'New event EVT-2026-0001: Sangeet', body: 'You are assigned. Leaves the warehouse 01-12-2026 09:00 IST', path: '/events/e1' });
  });
  it('covers every trigger the modules emit, with wording', () => {
    for (const trigger of Object.keys(TRIGGERS)) {
      expect(renderNotification(trigger, {}).title).not.toBe(trigger);
    }
  });
  it('damage alerts ignore quiet hours', () => {
    expect(TRIGGERS['damage.reported']!.bypassQuietHours).toBe(true);
  });
});
