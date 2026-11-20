import { z } from 'zod';
import { REPORT_IDS } from '../reports/registry';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const reportFiltersSchema = z.object({
  from: isoDate.optional(), to: isoDate.optional(), warehouseId: z.string().uuid().optional(), categoryId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(), userId: z.string().uuid().optional(), sessionId: z.string().uuid().optional()
}).strict();
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export const reportRunSchema = z.object({ filters: reportFiltersSchema.default({}), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(500).default(100) });
export const reportResultSchema = z.object({
  columns: z.array(z.object({ key: z.string(), label: z.string(), type: z.string() })),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))),
  total: z.number(), page: z.number(), pageSize: z.number()
});
export type ReportResult = z.infer<typeof reportResultSchema>;
export const reportRunStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(['running', 'succeeded', 'failed']), rowCount: z.number().nullable(), fileName: z.string().nullable(), downloadUrl: z.string().nullable(), error: z.string().nullable() });

export const reportScheduleInputSchema = z.object({
  reportId: z.enum(REPORT_IDS), name: z.string().trim().min(1).max(100), filters: reportFiltersSchema.default({}),
  frequency: z.enum(['daily', 'weekly', 'monthly']), weekday: z.number().int().min(1).max(7).optional(), monthDay: z.number().int().min(1).max(31).optional(),
  timeIst: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), recipientIds: z.array(z.string().uuid()).min(1).max(20)
}).refine((v) => v.frequency !== 'weekly' || v.weekday, { message: 'Choose the weekday', path: ['weekday'] })
  .refine((v) => v.frequency !== 'monthly' || v.monthDay, { message: 'Choose the day of the month', path: ['monthDay'] });
export const reportScheduleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(), filters: reportFiltersSchema.optional(), timeIst: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  weekday: z.number().int().min(1).max(7).optional(), monthDay: z.number().int().min(1).max(31).optional(), recipientIds: z.array(z.string().uuid()).min(1).max(20).optional(),
  status: z.enum(['active', 'paused']).optional()
});
export const reportScheduleSchema = z.object({
  id: z.string().uuid(), reportId: z.enum(REPORT_IDS), name: z.string(), filters: z.record(z.string()), frequency: z.enum(['daily', 'weekly', 'monthly']),
  weekday: z.number().nullable(), monthDay: z.number().nullable(), timeIst: z.string(), status: z.enum(['active', 'paused']),
  recipients: z.array(z.object({ id: z.string().uuid(), fullName: z.string() })), lastRun: z.object({ status: z.string(), finishedAt: z.string().nullable() }).nullable()
});
export type ReportSchedule = z.infer<typeof reportScheduleSchema>;

export const dashboardSchema = z.object({
  today: z.object({ dispatches: z.number(), returns: z.number() }),
  week: z.object({ dispatches: z.number(), returns: z.number() }),
  eventsByStatus: z.record(z.number()),
  pendingApprovals: z.object({ damage: z.number(), variances: z.number(), writeOffs: z.number(), corrections: z.number(), transferShortfalls: z.number() }),
  damageValueMonthPaise: z.number(), lowStockCount: z.number(), overbookedCount: z.number(),
  nextCounts: z.array(z.object({ name: z.string(), dueDate: z.string() }))
});
export type Dashboard = z.infer<typeof dashboardSchema>;
