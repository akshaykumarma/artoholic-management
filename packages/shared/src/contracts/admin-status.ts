import { z } from 'zod';
import { mobileVersionSettingSchema } from './app-version';

export const HEALTH_PARTS = ['database', 'fileStorage', 'backgroundWork'] as const;
export type HealthPart = (typeof HEALTH_PARTS)[number];

export const partStatusSchema = z.object({
  part: z.enum(HEALTH_PARTS),
  status: z.enum(['ok', 'down']),
  checkedAt: z.string()
});
export type PartStatus = z.infer<typeof partStatusSchema>;

export const overallSchema = z.enum(['ok', 'degraded', 'down']);
export type Overall = z.infer<typeof overallSchema>;

export const adminStatusSchema = z.object({
  overall: overallSchema,
  platformVersion: z.string(),
  checkedAt: z.string(),
  parts: z.array(partStatusSchema),
  mobileVersions: z.array(mobileVersionSettingSchema),
  /** 010 US7 */
  extended: z.object({
    jobQueue: z.number(),
    failedMessages24h: z.number(),
    storage: z.object({ usedBytes: z.number(), quotaBytes: z.number().nullable() }),
    lastBackup: z.object({ at: z.string(), status: z.string(), bytes: z.number().nullable() }).nullable(),
    appVersions: z.array(z.object({ platform: z.string(), version: z.string(), sessions: z.number() }))
  }).optional()
});
export type AdminStatus = z.infer<typeof adminStatusSchema>;

export const publicHealthSchema = z.object({ status: z.enum(['up', 'down']) }).strict();
