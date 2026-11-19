import { z } from 'zod';
import { EVENT_STATUSES } from '../events/status';

const qty = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const instant = z.string().datetime({ offset: true });

export const eventSourceInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('warehouse'), warehouseId: z.string().uuid(), qty }),
  z.object({ type: z.literal('event'), eventId: z.string().uuid(), qty })
]);
export const eventLineInputSchema = z.object({
  itemId: z.string().uuid(),
  plannedQty: qty,
  notes: z.string().max(300).optional(),
  sources: z.array(eventSourceInputSchema).min(1).max(10)
});
export type EventLineInput = z.infer<typeof eventLineInputSchema>;

/** Everything is optional for a Draft; scheduling checks completeness (EVENT_INCOMPLETE). */
export const eventInputSchema = z.object({
  name: z.string().trim().max(150),
  typeId: z.string().uuid().nullable(),
  description: z.string().max(2000),
  venueName: z.string().trim().max(150),
  venueAddress: z.string().max(300),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  placeId: z.string().max(200).nullable(),
  startsAt: instant.nullable(),
  endsAt: instant.nullable(),
  leaveWarehouseAt: instant.nullable(),
  expectedReturnDate: isoDate.nullable(),
  siteContactName: z.string().max(100),
  siteContactPhone: z.string().max(30).nullable(),
  notes: z.string().max(2000),
  eventManagerIds: z.array(z.string().uuid()).max(10),
  storeManagerIds: z.array(z.string().uuid()).max(10),
  lines: z.array(eventLineInputSchema).max(300)
}).partial();
export type EventInput = z.infer<typeof eventInputSchema>;
export const eventCreateSchema = eventInputSchema.extend({ schedule: z.boolean().optional() });

export const clashSchema = z.object({ id: z.string().uuid(), number: z.string(), name: z.string() });

export const eventWarningSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  warehouseId: z.string().uuid().nullable(),
  warehouseCode: z.string().nullable(),
  sourceEventId: z.string().uuid().nullable(),
  shortfallQty: z.string(),
  clashingEvents: z.array(clashSchema),
  raisedAt: z.string()
});
export type EventWarning = z.infer<typeof eventWarningSchema>;

export const eventSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  name: z.string(),
  typeId: z.string().uuid().nullable(),
  typeName: z.string().nullable(),
  description: z.string(),
  venueName: z.string(),
  venueAddress: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  leaveWarehouseAt: z.string().nullable(),
  expectedReturnDate: z.string().nullable(),
  siteContactName: z.string(),
  siteContactPhone: z.string().nullable(),
  notes: z.string(),
  status: z.enum(EVENT_STATUSES),
  cancelledReason: z.string().nullable(),
  version: z.number(),
  eventManagers: z.array(z.object({ id: z.string().uuid(), fullName: z.string() })),
  storeManagers: z.array(z.object({ id: z.string().uuid(), fullName: z.string() })),
  suggestedStoreManagers: z.array(z.object({ id: z.string().uuid(), fullName: z.string(), warehouseCode: z.string() })),
  lines: z.array(z.object({
    id: z.string().uuid(),
    itemId: z.string().uuid(),
    itemCode: z.string(),
    itemName: z.string(),
    unitCode: z.string().nullable(),
    plannedQty: z.string(),
    notes: z.string(),
    sources: z.array(z.object({
      type: z.enum(['warehouse', 'event']),
      warehouseId: z.string().uuid().nullable(),
      warehouseCode: z.string().nullable(),
      eventId: z.string().uuid().nullable(),
      eventNumber: z.string().nullable(),
      qty: z.string(),
      reservedQty: z.string()
    }))
  })),
  warnings: z.array(eventWarningSchema),
  /** Other events whose warnings name this one as a clash (US2-2). */
  clashWarnings: z.array(z.object({ eventId: z.string().uuid(), eventNumber: z.string(), eventName: z.string(), itemName: z.string(), shortfallQty: z.string() })),
  linesWithoutStoreManager: z.array(z.string().uuid())
});
export type EventDetail = z.infer<typeof eventSchema>;

export const eventRowSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  name: z.string(),
  typeName: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  venueName: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  leaveWarehouseAt: z.string().nullable(),
  expectedReturnDate: z.string().nullable(),
  overbooked: z.boolean()
});
export type EventRow = z.infer<typeof eventRowSchema>;
export const eventListSchema = z.object({ items: z.array(eventRowSchema), nextCursor: z.string().nullable() });

export const availabilityRequestSchema = z.object({
  eventId: z.string().uuid().optional(),
  leaveWarehouseAt: instant,
  expectedReturnDate: isoDate,
  lines: z.array(z.object({ itemId: z.string().uuid(), qty, warehouseId: z.string().uuid().optional() })).min(1).max(300)
});
export const availabilityResultSchema = z.object({
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    warehouseId: z.string().uuid().nullable(),
    available: z.string(),
    required: z.string(),
    shortfall: z.string(),
    suggestedWarehouseId: z.string().uuid().nullable(),
    byWarehouse: z.array(z.object({ warehouseId: z.string().uuid(), warehouseCode: z.string(), available: z.string() })),
    clashingEvents: z.array(clashSchema)
  }))
});
export type AvailabilityResult = z.infer<typeof availabilityResultSchema>;

export const cancelEventSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const eventTypeSchema = z.object({ id: z.string().uuid(), name: z.string(), status: z.enum(['active', 'archived']) });
export const eventTypeInputSchema = z.object({ name: z.string().trim().min(1).max(60), status: z.enum(['active', 'archived']).optional() });

export const todaySchema = z.object({ date: z.string(), dispatches: z.array(eventRowSchema), returns: z.array(eventRowSchema) });
export type TodayView = z.infer<typeof todaySchema>;
