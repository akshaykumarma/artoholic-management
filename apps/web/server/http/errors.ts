import { ERROR_STATUS, type ErrorCode } from '@artoholic/shared';
import { t, type MessageKey } from '@artoholic/shared';

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>,
    message?: string
  ) {
    super(message ?? t(`error.${code}` as MessageKey, details as Record<string, string> | undefined));
  }
  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export function errorResponse(err: ApiError, headers?: HeadersInit): Response {
  return Response.json(
    { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
    { status: err.status, headers }
  );
}
