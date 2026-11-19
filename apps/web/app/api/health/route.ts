import { runChecks, overallStatus } from '@/server/health/checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public uptime check: only "up" or "down", no internal detail (FR-041). */
export async function GET(_req: Request): Promise<Response> {
  const overall = overallStatus(await runChecks());
  const up = overall !== 'down';
  return Response.json({ status: up ? 'up' : 'down' }, { status: up ? 200 : 503 });
}
