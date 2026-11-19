import { z } from 'zod';

const qty = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');
const range = z.union([z.object({ from: z.union([z.string(), z.number()]), to: z.union([z.string(), z.number()]) }), z.object({ list: z.array(z.string()).min(1) })]);

export const warehouseUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().max(300),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  placeId: z.string().max(200).nullable(),
  contactPhone: z.string().max(30).nullable(),
  levels: z.array(z.string().trim().min(1).max(30)).min(1).max(5),
  storeManagerIds: z.array(z.string().uuid()),
  status: z.enum(['active', 'archived'])
}).partial();

export const warehouseDetailSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(['active', 'archived']),
  defaultLocationId: z.string().uuid().nullable(),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  contactPhone: z.string().nullable(),
  levels: z.array(z.string()),
  storeManagers: z.array(z.object({ id: z.string().uuid(), fullName: z.string() })),
  binCount: z.number(),
  hasStock: z.boolean()
});
export type WarehouseDetail = z.infer<typeof warehouseDetailSchema>;

export const locationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  level: z.number(),
  parentId: z.string().uuid().nullable(),
  segment: z.string().nullable(),
  status: z.enum(['active', 'archived']),
  isDefault: z.boolean(),
  isBin: z.boolean()
});
export type Location = z.infer<typeof locationSchema>;

export const locationCreateSchema = z.object({ parentId: z.string().uuid().nullable().optional(), segment: z.string().trim().min(1).max(6).regex(/^[A-Za-z0-9]+$/) });
export const bulkLocationsSchema = z.object({ parentId: z.string().uuid().nullable().optional(), ranges: z.array(range).min(1).max(5) });
export const locationUpdateSchema = z.object({ segment: z.string().trim().min(1).max(6).regex(/^[A-Za-z0-9]+$/), status: z.enum(['active', 'archived']) }).partial();

export const moveSchema = z.object({
  itemId: z.string().uuid(),
  pieceId: z.string().uuid().optional(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: qty,
  unit: z.string().optional(),
  condition: z.enum(['available', 'damaged']).default('available')
});

export const transferCreateSchema = z.object({
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  notes: z.string().max(500).optional(),
  lines: z.array(z.object({ itemId: z.string().uuid(), pieceId: z.string().uuid().optional(), quantity: qty })).min(1).max(500)
});
export const transferDispatchSchema = z.object({ lines: z.array(z.object({ lineId: z.string().uuid(), dispatchedQty: qty, fromLocationId: z.string().uuid() })).min(1) });
export const transferReceiveSchema = z.object({
  lines: z.array(z.object({ lineId: z.string().uuid(), receivedQty: qty, toLocationId: z.string().uuid() })).min(1),
  confirmMissing: z.boolean().optional()
});
export const shortfallSchema = z.object({ decision: z.enum(['lost', 'returned']), note: z.string().max(500).optional() });

export const transferSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  fromWarehouseId: z.string().uuid(),
  fromWarehouseCode: z.string(),
  toWarehouseId: z.string().uuid(),
  toWarehouseCode: z.string(),
  status: z.enum(['requested', 'dispatched', 'received', 'cancelled']),
  notes: z.string(),
  requestedAt: z.string(),
  lines: z.array(z.object({
    id: z.string().uuid(), itemId: z.string().uuid(), itemName: z.string(), pieceId: z.string().nullable(),
    requestedQty: z.string(), dispatchedQty: z.string().nullable(), receivedQty: z.string().nullable(), missingQty: z.string().nullable(),
    shortfallDecision: z.enum(['pending', 'lost', 'returned']).nullable()
  }))
});
export type Transfer = z.infer<typeof transferSchema>;
