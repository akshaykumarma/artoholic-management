import { ZodError, type ZodSchema } from 'zod';
import { ApiError, errorResponse } from './errors';
import { getRequestContext, type RequestContext } from './context';
import { csrfValid, CSRF_COOKIE, CSRF_HEADER } from '../auth/csrf';
import { SESSION_COOKIE } from '../auth/cookies';
import { logger } from './logger';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface HandlerOptions {
  /** Skip CSRF for endpoints used before a session exists (sign-in). */
  csrfExempt?: boolean;
}

type Fn = (req: Request, ctx: RequestContext, params: Record<string, string>) => Promise<Response>;

/**
 * Wraps a route handler: builds the request context, enforces CSRF for web state changes
 * that carry a session cookie, and turns errors into the shared error format.
 */
export function api(fn: Fn, opts: HandlerOptions = {}) {
  return async (req: Request, route?: { params?: Record<string, string> }): Promise<Response> => {
    const ctx = getRequestContext(req);
    try {
      if (
        !opts.csrfExempt &&
        STATE_CHANGING.has(req.method) &&
        ctx.platform === 'web' &&
        ctx.cookies[SESSION_COOKIE] &&
        !csrfValid(ctx.cookies[CSRF_COOKIE], req.headers.get(CSRF_HEADER))
      ) {
        throw new ApiError('CSRF_FAILED');
      }
      return await fn(req, ctx, route?.params ?? {});
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      if (err instanceof ZodError) {
        const fields = Object.fromEntries(err.issues.map((i) => [i.path.join('.') || '_', i.message]));
        return errorResponse(new ApiError('VALIDATION_FAILED', { fields }));
      }
      logger.error('unhandled error', { path: new URL(req.url).pathname, error: (err as Error).stack });
      return errorResponse(new ApiError('INTERNAL'));
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError('VALIDATION_FAILED', { fields: { _: 'Body must be JSON' } });
  }
  return schema.parse(raw);
}
