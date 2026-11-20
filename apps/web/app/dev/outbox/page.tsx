/* eslint-disable react/jsx-no-literals -- developer tool, English only, never shown in production. */
import { notFound } from 'next/navigation';
import { getPool } from '@/db/client';

export const dynamic = 'force-dynamic';

/**
 * Local testing only (DEV_TOOLS=true and not production): what the mock WhatsApp, email and push
 * providers would have delivered, including password-reset codes. The real message log stays redacted.
 */
export default async function DevOutboxPage() {
  if (process.env.DEV_TOOLS !== 'true' || process.env.NODE_ENV === 'production') notFound();
  const { rows } = await getPool().query<{ id: number; channel: string; to_address: string; body: string; created_at: Date }>(
    'SELECT id, channel, to_address, body, created_at FROM dev_outbox ORDER BY id DESC LIMIT 100'
  );
  return (
    <main className="main" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>Dev outbox</h1>
      <p>Messages the mock providers would have sent (newest first). Local testing only.</p>
      <table>
        <thead><tr><th>When</th><th>Channel</th><th>To</th><th>Message</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              <td>{r.channel}</td>
              <td>{r.to_address}</td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{r.body}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
