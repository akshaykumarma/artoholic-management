import { z } from 'zod';
import { EVENT_STATUSES } from '../events/status';

const qty = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');
export const STEP_TYPES = ['warehouse_dispatch', 'site_receipt', 'return_dispatch', 'warehouse_receipt'] as const;
export type StepType = (typeof STEP_TYPES)[number];
export const SHORT_REASONS = ['out_of_stock', 'damaged_on_pick', 'admin_decision', 'other'] as const;

export const roundsSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(EVENT_STATUSES),
  rounds: z.array(z.object({
    id: z.string().uuid(),
    round: z.number(),
    steps: z.array(z.object({
      id: z.string().uuid(),
      step: z.enum(STEP_TYPES),
      warehouseId: z.string().uuid().nullable(),
      warehouseCode: z.string().nullable(),
      status: z.enum(['not_started', 'in_progress', 'submitted']),
      ready: z.boolean(),
      canPerform: z.boolean(),
      submittedAt: z.string().nullable()
    }))
  }))
});
export type Rounds = z.infer<typeof roundsSchema>;

export const stepRowSchema = z.object({
  entryId: z.string().uuid(),
  sourceId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemCode: z.string(),
  itemName: z.string(),
  trackingType: z.enum(['counted', 'measured', 'cut']),
  unitCode: z.string().nullable(),
  sourceLabel: z.string(),
  usualBin: z.string().nullable(),
  /** Planned (dispatch) or what the previous step handed on (receipts, return). */
  expected: z.string(),
  done: z.boolean(),
  dispatched: z.string().nullable(),
  received: z.string().nullable(),
  returned: z.string().nullable(),
  handedOver: z.string().nullable(),
  handoverEventId: z.string().uuid().nullable(),
  handoverOptions: z.array(z.object({ eventId: z.string().uuid(), number: z.string(), name: z.string() })),
  consumed: z.string().nullable(),
  damaged: z.string().nullable(),
  missing: z.string().nullable(),
  remainingLength: z.string().nullable(),
  shortReason: z.enum(SHORT_REASONS).nullable(),
  note: z.string(),
  binLocationId: z.string().uuid().nullable(),
  pieceId: z.string().uuid().nullable(),
  pieceOptions: z.array(z.object({ id: z.string().uuid(), number: z.string(), length: z.string() })),
  photoKeys: z.array(z.string()),
  /** A rejected report on this line waits for the reporter to re-check it (US3-2). */
  recheckReportId: z.string().uuid().nullable()
});
export type StepRow = z.infer<typeof stepRowSchema>;

export const stepSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  eventNumber: z.string(),
  eventName: z.string(),
  round: z.number(),
  step: z.enum(STEP_TYPES),
  warehouseId: z.string().uuid().nullable(),
  warehouseCode: z.string().nullable(),
  status: z.enum(['not_started', 'in_progress', 'submitted']),
  version: z.number(),
  ready: z.boolean(),
  submittedAt: z.string().nullable(),
  submittedBy: z.string().nullable(),
  transport: z.object({ vehicleNumber: z.string().nullable(), driverName: z.string().nullable(), driverPhone: z.string().nullable() }),
  bins: z.array(z.object({ id: z.string().uuid(), code: z.string() })),
  rows: z.array(stepRowSchema)
});
export type Step = z.infer<typeof stepSchema>;

export const entryInputSchema = z.object({
  entryId: z.string().uuid(),
  done: z.boolean().optional(),
  dispatched: qty.optional(),
  received: qty.optional(),
  returned: qty.optional(),
  handedOver: qty.optional(),
  handoverEventId: z.string().uuid().nullable().optional(),
  consumed: qty.optional(),
  damaged: qty.optional(),
  remainingLength: qty.nullable().optional(),
  shortReason: z.enum(SHORT_REASONS).nullable().optional(),
  note: z.string().max(500).optional(),
  binLocationId: z.string().uuid().nullable().optional(),
  pieceId: z.string().uuid().nullable().optional(),
  photoKeys: z.array(z.string().max(300)).max(10).optional()
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const progressSchema = z.object({ entries: z.array(entryInputSchema).max(500) });
export const submitStepSchema = z.object({
  version: z.number().int(),
  entries: z.array(entryInputSchema).max(500),
  transport: z.object({ vehicleNumber: z.string().max(20).optional(), driverName: z.string().max(80).optional(), driverPhone: z.string().max(30).optional() }).optional(),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  deviceLabel: z.string().max(80).optional(),
  confirmMissing: z.boolean().optional()
});
export type SubmitStep = z.infer<typeof submitStepSchema>;
export const recheckSchema = z.object({ damaged: qty, missing: qty.optional(), note: z.string().max(500).optional(), photoKeys: z.array(z.string()).max(10).optional() });

export const newRoundSchema = z.object({
  lines: z.array(z.object({ itemId: z.string().uuid(), plannedQty: qty, warehouseId: z.string().uuid() })).min(1).max(100)
});
export const eventCorrectionSchema = z.object({
  lineSourceId: z.string().uuid(),
  field: z.enum(['returned', 'consumed', 'lost', 'damaged']),
  newValue: qty,
  reason: z.string().trim().min(3).max(500)
});

export const lineTotalsSchema = z.object({
  sourceId: z.string().uuid(),
  itemName: z.string(),
  sourceLabel: z.string(),
  dispatched: z.string(), received: z.string(), returned: z.string(), handedOver: z.string(), consumed: z.string(),
  damagedApproved: z.string(), lostApproved: z.string(), outstanding: z.string(), reconciled: z.boolean()
});
export type LineTotalsRow = z.infer<typeof lineTotalsSchema>;

export const activitySchema = z.object({
  items: z.array(z.object({ at: z.string(), actor: z.string().nullable(), action: z.string(), detail: z.record(z.unknown()).nullable() }))
});

export const damageReportSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  eventId: z.string().uuid(),
  eventNumber: z.string(),
  eventName: z.string(),
  itemName: z.string(),
  step: z.enum(STEP_TYPES),
  kind: z.enum(['damaged', 'missing']),
  quantity: z.string(),
  note: z.string(),
  reportedBy: z.string(),
  reportedAt: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionComment: z.string().nullable(),
  photos: z.array(z.object({ id: z.string().uuid(), url: z.string() })),
  photosDeleted: z.boolean()
});
export type DamageReport = z.infer<typeof damageReportSchema>;
export const damageDecisionSchema = z.object({ comment: z.string().max(500).optional() });
export const rejectDecisionSchema = z.object({ comment: z.string().trim().min(3).max(500) });
