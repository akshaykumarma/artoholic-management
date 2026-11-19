import { z } from 'zod';
import { FREQUENCIES } from '../counts/schedule';

const qty = z.string().regex(/^\d+(\.\d{1,3})?$/, 'Use a number with up to 3 decimals');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const scope = z.object({ warehouseIds: z.array(z.string().uuid()).max(50).default([]), categoryIds: z.array(z.string().uuid()).max(100).default([]) });

export const countScheduleInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  frequency: z.enum(FREQUENCIES),
  startDate: isoDate,
  scope,
  assigneeIds: z.array(z.string().uuid()).min(1).max(20),
  blind: z.boolean().default(true)
});
export const countScheduleUpdateSchema = countScheduleInputSchema.partial().extend({ status: z.enum(['active', 'paused']).optional() });
export const countScheduleSchema = z.object({
  id: z.string().uuid(), name: z.string(), frequency: z.enum(FREQUENCIES), startDate: z.string(), nextDueDate: z.string(), blind: z.boolean(),
  status: z.enum(['active', 'paused']), scope: z.object({ warehouseIds: z.array(z.string()), categoryIds: z.array(z.string()) }),
  assignees: z.array(z.object({ id: z.string().uuid(), fullName: z.string() }))
});
export type CountSchedule = z.infer<typeof countScheduleSchema>;

export const adHocCountSchema = z.object({ scope, assigneeIds: z.array(z.string().uuid()).min(1).max(20), blind: z.boolean().default(true) });

export const COUNT_STATUSES = ['open', 'submitted', 'in_review', 'completed'] as const;
export const countSessionRowSchema = z.object({
  id: z.string().uuid(), number: z.string(), scheduleName: z.string().nullable(), dueDate: z.string(), blind: z.boolean(),
  status: z.enum(COUNT_STATUSES), lineCount: z.number(), countedCount: z.number(), overdue: z.boolean(), notes: z.string()
});
export type CountSessionRow = z.infer<typeof countSessionRowSchema>;

export const countLineSchema = z.object({
  id: z.string().uuid(), itemId: z.string().uuid(), itemCode: z.string(), itemName: z.string(), unitCode: z.string().nullable(),
  pieceId: z.string().uuid().nullable(), pieceNumber: z.string().nullable(), locationId: z.string().uuid(), locationCode: z.string(),
  condition: z.enum(['available', 'reserved', 'damaged']),
  /** Omitted for counters in a blind count (research R4). */
  recordedQty: z.string().optional(),
  countedQty: z.string().nullable(), note: z.string(), photoKey: z.string().nullable(), countedBy: z.string().nullable(),
  addedByCounter: z.boolean(), eventMovement: z.boolean(), decision: z.enum(['matched', 'pending', 'approved', 'rejected', 'recount']).nullable()
});
export type CountLine = z.infer<typeof countLineSchema>;
export const countSheetSchema = z.object({
  id: z.string().uuid(), number: z.string(), dueDate: z.string(), blind: z.boolean(), status: z.enum(COUNT_STATUSES), canCount: z.boolean(),
  locations: z.array(z.object({ id: z.string().uuid(), code: z.string() })), lines: z.array(countLineSchema)
});
export type CountSheet = z.infer<typeof countSheetSchema>;
export const countEntriesSchema = z.object({
  entries: z.array(z.object({
    lineId: z.string().uuid().optional(), itemId: z.string().uuid().optional(), pieceId: z.string().uuid().nullable().optional(),
    locationId: z.string().uuid().optional(), countedQty: qty.nullable(), note: z.string().max(500).optional(), photoKey: z.string().max(300).nullable().optional()
  })).max(2000)
});
export const countSubmitSchema = z.object({ confirmZero: z.boolean().optional() });

export const countReviewLineSchema = countLineSchema.extend({
  recordedQty: z.string(), varianceQty: z.string(), variancePaise: z.number(), decisionReason: z.string().nullable(), decidedBy: z.string().nullable()
});
export const countReviewSchema = z.object({
  id: z.string().uuid(), number: z.string(), status: z.enum(COUNT_STATUSES), submittedBy: z.string().nullable(), submittedAt: z.string().nullable(),
  totalVariancePaise: z.number(), lines: z.array(countReviewLineSchema)
});
export type CountReview = z.infer<typeof countReviewSchema>;
export const countDecisionSchema = z.object({ reason: z.string().trim().min(3).max(500) });
