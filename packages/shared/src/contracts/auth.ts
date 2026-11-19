import { z } from 'zod';
import { ROLES } from '../types';

/** Sign in with username, email or phone (002 FR-006). `username` is accepted as an alias of `identifier`. */
export const signInRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).max(200).optional(),
    username: z.string().trim().min(1).max(200).optional(),
    password: z.string().min(1).max(200)
  })
  .refine((v) => v.identifier || v.username, { message: 'Required', path: ['identifier'] })
  .transform((v) => ({ identifier: (v.identifier ?? v.username)!, password: v.password }));
export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const menuItemSchema = z.object({ moduleId: z.string(), labelKey: z.string(), path: z.string() });

export const meResponseSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  username: z.string(),
  roles: z.array(z.enum(ROLES)),
  menu: z.array(menuItemSchema),
  mustChangePassword: z.boolean(),
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

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });
export const forgotPasswordSchema = z.object({ identifier: z.string().trim().min(1).max(200) });
export const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: z.string().min(1).max(200)
});
export const biometricSchema = z.object({ enabled: z.boolean() });
