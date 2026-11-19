export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'test') {
    const { startJobs } = await import('./server/jobs/boss');
    await startJobs();
  }
}
