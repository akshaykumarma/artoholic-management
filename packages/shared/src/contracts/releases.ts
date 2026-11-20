import { z } from 'zod';

/** 011 release checklist (US2-1), recorded per platform and build. */
export const RELEASE_CHECKS = ['sign_in', 'menu', 'dispatch', 'receipt_photo', 'damage_approval', 'count_entry', 'push', 'update_prompt'] as const;
export type ReleaseCheck = (typeof RELEASE_CHECKS)[number];
export const STORE_STATUSES = ['internal', 'in_review', 'live', 'rejected'] as const;

export const releaseInputSchema = z.object({
  platform: z.enum(['android', 'ios']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use MAJOR.MINOR.PATCH'),
  buildNumber: z.number().int().positive(),
  notes: z.string().trim().min(1, 'Write release notes').max(4000)
});
export const releaseUpdateSchema = z.object({ storeStatus: z.enum(STORE_STATUSES), rejectionReason: z.string().max(1000).optional() });
export const releaseCheckInputSchema = z.object({ check: z.enum(RELEASE_CHECKS), passed: z.boolean(), device: z.string().max(120).default(''), note: z.string().max(500).default('') });
export const releaseSchema = z.object({
  id: z.string().uuid(), platform: z.enum(['android', 'ios']), version: z.string(), buildNumber: z.number(), notes: z.string(),
  storeStatus: z.enum(STORE_STATUSES), rejectionReason: z.string().nullable(), createdAt: z.string(), liveAt: z.string().nullable(),
  checks: z.array(z.object({ check: z.enum(RELEASE_CHECKS), passed: z.boolean(), testedBy: z.string(), device: z.string(), note: z.string(), at: z.string() })),
  checklistComplete: z.boolean()
});
export type Release = z.infer<typeof releaseSchema>;

export const deletionRequestSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), userName: z.string(), requestedAt: z.string(), dueAt: z.string(),
  status: z.enum(['pending', 'completed', 'withdrawn']), completedAt: z.string().nullable()
});
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;
