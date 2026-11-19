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
  mobileVersions: z.array(mobileVersionSettingSchema)
});
export type AdminStatus = z.infer<typeof adminStatusSchema>;

export const publicHealthSchema = z.object({ status: z.enum(['up', 'down']) }).strict();
