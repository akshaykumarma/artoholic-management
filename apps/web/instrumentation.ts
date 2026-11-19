export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'test') {
    const { startJobs } = await import('./server/jobs/boss');
    // Never let background jobs stop the web app from serving; the status page shows them as down.
    await startJobs().catch((err) => console.error(JSON.stringify({ level: 'error', msg: 'jobs failed to start', error: String(err) })));
  }
}
