import { z } from 'zod';
import { CONDITIONS } from '../inventory/conditions';

const qty = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');
const signedQty = z.string().regex(/^-?\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');

export const openingStockSchema = z.object({
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    locationId: z.string().uuid(),
    condition: z.enum(['available', 'damaged']).default('available'),
    quantity: qty,
    unit: z.string().optional()
  })).min(1).max(5000)
});

export const cutSchema = z.object({ pieceId: z.string().uuid(), length: qty, unit: z.string().optional() });

export const correctionSchema = z.object({
  itemId: z.string().uuid(),
  pieceId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  condition: z.enum(['available', 'damaged']),
  quantityChange: signedQty.refine((v) => Number(v) !== 0, 'Change cannot be zero'),
  unit: z.string().optional(),
  reason: z.string().trim().min(1).max(500)
});

export const writeOffSchema = z.object({
  itemId: z.string().uuid(),
  pieceId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  quantity: qty,
  reason: z.string().trim().min(1).max(500)
});
export const returnToAvailableSchema = writeOffSchema;
export const decisionSchema = z.object({ note: z.string().trim().max(500).optional() });

export const correctionRequestSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['correction', 'write_off']),
  itemId: z.string().uuid(),
  itemName: z.string(),
  locationCode: z.string().nullable(),
  condition: z.enum(CONDITIONS),
  quantityChange: z.string(),
  reason: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  movementId: z.number().nullable()
});

export const cutResultSchema = z.object({
  cutPiece: z.object({ id: z.string(), pieceNumber: z.string(), length: z.string() }),
  offcut: z.object({ id: z.string(), pieceNumber: z.string(), length: z.string() })
});
