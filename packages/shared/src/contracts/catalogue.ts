import { z } from 'zod';
import { TRACKING_TYPES, CONDITIONS } from '../inventory/conditions';

const qty = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'archived']).optional()
});
export const categorySchema = z.object({ id: z.string().uuid(), name: z.string(), parentId: z.string().uuid().nullable(), status: z.enum(['active', 'archived']) });
export type Category = z.infer<typeof categorySchema>;

export const unitInputSchema = z.object({
  code: z.string().regex(/^[a-z]{1,8}$/),
  name: z.string().trim().min(1).max(40),
  family: z.enum(['length', 'mass', 'volume']),
  factorToBase: z.string().regex(/^\d+(\.\d{1,6})?$/),
  status: z.enum(['active', 'archived']).optional()
});
export const unitSchema = z.object({ code: z.string(), name: z.string(), family: z.string(), factorToBase: z.string(), status: z.enum(['active', 'archived']) });
export type Unit = z.infer<typeof unitSchema>;

export const itemInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9._-]+$/, 'Use letters, digits and . _ - only').optional(),
  categoryId: z.string().uuid(),
  description: z.string().max(2000).optional(),
  trackingType: z.enum(TRACKING_TYPES),
  unitCode: z.string().nullable().optional(),
  replacementValuePaise: z.number().int().min(0),
  minimumStock: qty.nullable().optional(),
  minimumUsableLength: qty.nullable().optional(),
  notes: z.string().max(2000).optional()
});
export const itemUpdateSchema = itemInputSchema.omit({ trackingType: true }).partial().extend({ status: z.enum(['active', 'archived']).optional() });

export const itemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  description: z.string(),
  trackingType: z.enum(TRACKING_TYPES),
  unitCode: z.string().nullable(),
  replacementValuePaise: z.number(),
  minimumStock: z.string().nullable(),
  minimumUsableLength: z.string().nullable(),
  notes: z.string(),
  status: z.enum(['active', 'archived']),
  updatedAt: z.string()
});
export type Item = z.infer<typeof itemSchema>;

export const itemListSchema = z.object({
  items: z.array(itemSchema.extend({ available: z.string(), onHand: z.string() })),
  nextCursor: z.string().nullable()
});

const balanceRow = z.object({
  warehouseCode: z.string().nullable(),
  locationCode: z.string().nullable(),
  locationId: z.string().nullable(),
  eventId: z.string().nullable(),
  pieceNumber: z.string().nullable(),
  pieceId: z.string().nullable(),
  condition: z.enum(CONDITIONS),
  quantity: z.string()
});

export const itemViewSchema = z.object({
  item: itemSchema,
  codes: z.array(z.object({ code: z.string(), activeFrom: z.string(), activeTo: z.string().nullable() })),
  photos: z.array(z.object({ id: z.string(), url: z.string(), position: z.number() })),
  totals: z.record(z.enum(CONDITIONS), z.string()),
  onHand: z.string(),
  balances: z.array(balanceRow),
  pieces: z.array(z.object({ id: z.string(), pieceNumber: z.string(), currentLength: z.string(), originalLength: z.string(), status: z.string(), belowMinimum: z.boolean(), locationCode: z.string().nullable(), condition: z.string().nullable() })),
  lastUsedIn: z.object({ eventId: z.string(), at: z.string() }).nullable(),
  reservations: z.array(z.object({ eventId: z.string(), quantity: z.string() })),
  damage: z.object({ damagedToDate: z.string(), currentlyDamaged: z.string(), writtenOff: z.string(), lost: z.string() }),
  history: z.array(z.object({ id: z.number(), type: z.string(), quantity: z.string(), occurredAt: z.string(), reason: z.string().nullable(), fromCondition: z.string().nullable(), toCondition: z.string().nullable(), referenceType: z.string().nullable(), referenceId: z.string().nullable(), actor: z.string().nullable() }))
});
export type ItemView = z.infer<typeof itemViewSchema>;

export const warehouseInputSchema = z.object({ code: z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9]{2,8}$/, '2–8 letters or digits')), name: z.string().trim().min(1).max(80) });
export const warehouseSchema = z.object({ id: z.string().uuid(), code: z.string(), name: z.string(), status: z.enum(['active', 'archived']), defaultLocationId: z.string().uuid().nullable() });
export type Warehouse = z.infer<typeof warehouseSchema>;
