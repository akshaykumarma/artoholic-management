import PgBoss from 'pg-boss';
import { getPool } from '../../db/client';
import { logger } from '../http/logger';
import { beat, HEARTBEAT_JOB } from './heartbeat';
import { runStockRebuildCheck, STOCK_REBUILD_JOB } from './stock-rebuild-check';
import { EVENT_REMINDERS_JOB, runEventReminders } from './events/reminders';
import { RESERVATION_CHECK_JOB, runReservationCheck } from './events/reservation-check';
import { sweepWarnings, WARNINGS_SWEEP_JOB } from './events/reevaluate-warnings';
import { COUNT_CREATE_JOB, COUNT_ESCALATE_JOB, runCreateDue, runEscalate } from './counts/jobs';
import { processOutbox } from '../notifications/dispatcher';
import { processJobs } from '../notifications/sender';
import { purgeOldNotifications } from '../notifications/centre';

const NOTIFY_PURGE_JOB = 'notifications-purge';

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
  await boss.createQueue(COUNT_CREATE_JOB);
  await boss.work(COUNT_CREATE_JOB, async () => void (await runCreateDue()));
  await boss.schedule(COUNT_CREATE_JOB, '31 1 * * *'); // 07:01 IST
  await boss.createQueue(COUNT_ESCALATE_JOB);
  await boss.work(COUNT_ESCALATE_JOB, async () => void (await runEscalate()));
  await boss.schedule(COUNT_ESCALATE_JOB, '35 1 * * *'); // 07:05 IST
  // In-app and push within 30 s (FR-010): the outbox and delivery queue are drained every 5 s.
  let draining = false;
  setInterval(() => {
    if (draining) return;
    draining = true;
    processOutbox().then(() => processJobs()).catch((err) => logger.error('notification delivery failed', { error: (err as Error).message })).finally(() => { draining = false; });
  }, 5_000).unref();
  await boss.createQueue(NOTIFY_PURGE_JOB);
  await boss.work(NOTIFY_PURGE_JOB, async () => void (await purgeOldNotifications()));
  await boss.schedule(NOTIFY_PURGE_JOB, '0 22 * * *'); // 03:30 IST
  logger.info('background jobs started');
}
