import { z } from 'zod';
import { ROLES } from '../types';

export const usernameSchema = z.string().trim().min(3).max(120).regex(/^[A-Za-z0-9._@+-]+$/, 'Use letters, digits and . _ @ + - only');

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1, 'Phone number is required'),
  email: z.string().trim().email().max(200).optional().or(z.literal('').transform(() => undefined)),
  username: usernameSchema.optional().or(z.literal('').transform(() => undefined)),
  temporaryPassword: z.string().min(1).max(200),
  roles: z.array(z.enum(ROLES)).min(1, 'Choose at least one role'),
  warehouseIds: z.array(z.string().uuid()).optional()
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1),
    email: z.string().trim().email().max(200).nullable(),
    username: usernameSchema,
    roles: z.array(z.enum(ROLES)).min(1),
    warehouseIds: z.array(z.string().uuid())
  })
  .partial();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  username: z.string(),
  roles: z.array(z.enum(ROLES)),
  warehouseIds: z.array(z.string().uuid()),
  status: z.enum(['active', 'deactivated']),
  mustChangePassword: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type User = z.infer<typeof userSchema>;

export const userListSchema = z.object({ items: z.array(userSchema), nextCursor: z.string().nullable() });

export const temporaryPasswordSchema = z.object({ temporaryPassword: z.string().min(1).max(200) });
export const deactivateSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export const reactivateSchema = temporaryPasswordSchema;
