import { getPool } from '@/db/client';
import { logger } from '@/server/http/logger';
import { providerConfig, validWebhookSignature } from '@/server/notifications/providers';
import { recordProviderStatus } from '@/server/notifications/sender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Meta's subscription check: echo the challenge when the verify token matches. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const { config } = await providerConfig(getPool(), 'whatsapp');
  if (u.searchParams.get('hub.mode') === 'subscribe' && config.verifyToken && u.searchParams.get('hub.verify_token') === config.verifyToken) {
    return new Response(u.searchParams.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Delivery statuses (sent, delivered, read, failed), accepted only with a valid signature. */
export async function POST(req: Request) {
  const raw = await req.text();
  const { secret } = await providerConfig(getPool(), 'whatsapp');
  const appSecret = secret ? (JSON.parse(secret) as { appSecret?: string }).appSecret : undefined;
  if (!appSecret || !validWebhookSignature(raw, req.headers.get('x-hub-signature-256'), appSecret)) return new Response('Invalid signature', { status: 401 });
  try {
    const body = JSON.parse(raw) as { entry?: Array<{ changes?: Array<{ value?: { statuses?: Array<{ id: string; status: string; errors?: Array<{ title?: string }> }> } }> }> };
    for (const e of body.entry ?? []) for (const c of e.changes ?? []) for (const s of c.value?.statuses ?? []) {
      await recordProviderStatus(s.id, s.status, s.errors?.[0]?.title ?? null);
    }
  } catch (err) {
    logger.error('whatsapp webhook parse failed', { error: (err as Error).message });
  }
  return new Response('ok', { status: 200 });
}
