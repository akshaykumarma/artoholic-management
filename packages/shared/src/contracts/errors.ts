import { z } from 'zod';

/** Error codes shared by the API and all three apps (contracts/api-v1.md). */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'NOT_SIGNED_IN',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'CSRF_FAILED',
  'APP_UPDATE_REQUIRED',
  'SIGN_IN_LOCKED',
  'NOT_FOUND',
  'INTERNAL',
  'PASSWORD_CHANGE_REQUIRED',
  'IDENTIFIER_TAKEN',
  'LAST_ADMIN',
  'SELF_DEACTIVATION',
  'SUPER_ADMIN_ONLY',
  'PASSWORD_POLICY',
  'RESET_CODE_INVALID',
  'STALE_VERSION'
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_SIGNED_IN: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  CSRF_FAILED: 403,
  APP_UPDATE_REQUIRED: 426,
  SIGN_IN_LOCKED: 429,
  NOT_FOUND: 404,
  INTERNAL: 500,
  PASSWORD_CHANGE_REQUIRED: 403,
  IDENTIFIER_TAKEN: 409,
  LAST_ADMIN: 409,
  SELF_DEACTIVATION: 409,
  SUPER_ADMIN_ONLY: 403,
  PASSWORD_POLICY: 400,
  RESET_CODE_INVALID: 400,
  STALE_VERSION: 409
};
