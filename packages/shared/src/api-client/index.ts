import type { ZodType } from 'zod';
import type { ClientPlatform } from '../types';
import { errorBodySchema, type ErrorCode } from '../contracts/errors';
import { t } from '../i18n';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | 'NETWORK',
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  platform: ClientPlatform;
  version: string;
  /** Mobile: returns the bearer token. */
  getToken?: () => Promise<string | null>;
  /** Web: returns the csrf cookie value. */
  getCsrf?: () => string | null;
  onSessionExpired?: () => void;
  onUpdateRequired?: (details: Record<string, unknown> | undefined) => void;
  fetchImpl?: typeof fetch;
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** One typed client for web and mobile (constitution III). */
export function createApiClient(o: ApiClientOptions) {
  const doFetch = o.fetchImpl ?? fetch;

  async function request<T>(method: string, path: string, opts: { body?: unknown; schema?: ZodType<T>; headers?: Record<string, string> } = {}): Promise<T> {
    const headers: Record<string, string> = { 'x-client-platform': o.platform, 'x-client-version': o.version, ...opts.headers };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (o.platform === 'web' && STATE_CHANGING.has(method)) {
      const csrf = o.getCsrf?.();
      if (csrf) headers['x-csrf-token'] = csrf;
    }
    if (o.platform !== 'web') {
      const token = await o.getToken?.();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    let res: Response;
    try {
      res = await doFetch(`${o.baseUrl}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        credentials: o.platform === 'web' ? 'include' : 'omit'
      });
    } catch {
      throw new ApiClientError(0, 'NETWORK', t('error.network'));
    }
    if (res.status === 204) return undefined as T;
    const json: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const parsed = errorBodySchema.safeParse(json);
      const code = parsed.success ? parsed.data.error.code : 'INTERNAL';
      const details = parsed.success ? parsed.data.error.details : undefined;
      if (code === 'SESSION_EXPIRED') o.onSessionExpired?.();
      if (code === 'APP_UPDATE_REQUIRED') o.onUpdateRequired?.(details);
      throw new ApiClientError(res.status, code, parsed.success ? parsed.data.error.message : t('error.INTERNAL'), details);
    }
    return opts.schema ? opts.schema.parse(json) : (json as T);
  }

  return {
    request,
    get: <T>(path: string, schema?: ZodType<T>) => request<T>('GET', path, { schema }),
    post: <T>(path: string, body?: unknown, schema?: ZodType<T>) => request<T>('POST', path, { body, schema }),
    put: <T>(path: string, body?: unknown, schema?: ZodType<T>) => request<T>('PUT', path, { body, schema }),
    patch: <T>(path: string, body?: unknown, schema?: ZodType<T>) => request<T>('PATCH', path, { body, schema })
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
