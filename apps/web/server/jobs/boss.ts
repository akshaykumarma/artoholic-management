import PgBoss from 'pg-boss';
import { getPool } from '../../db/client';
import { logger } from '../http/logger';
import { beat, HEARTBEAT_JOB } from './heartbeat';
import { runStockRebuildCheck, STOCK_REBUILD_JOB } from './stock-rebuild-check';
import { EVENT_REMINDERS_JOB, runEventReminders } from './events/reminders';
import { RESERVATION_CHECK_JOB, runReservationCheck } from './events/reservation-check';
import { sweepWarnings, WARNINGS_SWEEP_JOB } from './events/reevaluate-warnings';

let boss: PgBoss | undefined;

/** Starts pg-boss and the 30-second heartbeat that the status page reads (research R8). */
export async function startJobs(): Promise<void> {
  if (boss) return;
  boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  boss.on('error', (err) => logger.error('pg-boss error', { error: err.message }));
  await boss.start();
  await beat(getPool());
  // pg-boss cron runs at most once a minute; a 30 s in-process timer keeps the beat fresh between runs.
  setInterval(() => beat(getPool()).catch((err) => logger.error('heartbeat failed', { error: (err as Error).message })), 30_000).unref();
  await boss.createQueue(HEARTBEAT_JOB);
  await boss.work(HEARTBEAT_JOB, async () => beat(getPool()));
  await boss.schedule(HEARTBEAT_JOB, '* * * * *');
  await boss.createQueue(STOCK_REBUILD_JOB);
  await boss.work(STOCK_REBUILD_JOB, async () => void (await runStockRebuildCheck()));
  await boss.schedule(STOCK_REBUILD_JOB, '30 21 * * *'); // 03:00 IST
  await boss.createQueue(EVENT_REMINDERS_JOB);
  await boss.work(EVENT_REMINDERS_JOB, async () => void (await runEventReminders()));
  await boss.schedule(EVENT_REMINDERS_JOB, '* * * * *');
  await boss.createQueue(WARNINGS_SWEEP_JOB);
  await boss.work(WARNINGS_SWEEP_JOB, async () => sweepWarnings());
  await boss.schedule(WARNINGS_SWEEP_JOB, '*/2 * * * *');
  await boss.createQueue(RESERVATION_CHECK_JOB);
  await boss.work(RESERVATION_CHECK_JOB, async () => void (await runReservationCheck()));
  await boss.schedule(RESERVATION_CHECK_JOB, '45 21 * * *'); // 03:15 IST
  logger.info('background jobs started');
}
