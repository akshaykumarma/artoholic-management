import { z } from 'zod';
import { ROLES } from '../types';

export const signInRequestSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200)
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const menuItemSchema = z.object({ moduleId: z.string(), labelKey: z.string(), path: z.string() });

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  username: z.string(),
  roles: z.array(z.enum(ROLES)),
  menu: z.array(menuItemSchema),
  session: z.object({ expiresAt: z.string().datetime(), idleTimeoutMinutes: z.number().int().nullable() })
});
export type Me = z.infer<typeof meResponseSchema>;

export const signInWebResponseSchema = z.object({ user: meResponseSchema });
export const signInMobileResponseSchema = z.object({
  user: meResponseSchema,
  token: z.string(),
  expiresAt: z.string().datetime()
});
export type SignInMobileResponse = z.infer<typeof signInMobileResponseSchema>;
