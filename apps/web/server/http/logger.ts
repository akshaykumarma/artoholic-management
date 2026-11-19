/** Structured JSON logger (constitution V: reconstruct who did what without a debugger). */
type Level = 'debug' | 'info' | 'warn' | 'error';

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && level === 'debug') return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => write('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => write('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => write('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => write('error', msg, f)
};
