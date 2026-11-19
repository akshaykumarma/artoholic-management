/** One-time codes never reach the message log (owner decision; research R5). */
export const REDACTED = '••••••';

export function redact(trigger: string, text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) if (s) out = out.split(s).join(REDACTED);
  if (trigger.startsWith('auth.')) out = out.replace(/(?<!\d)\d{4,8}(?!\d)/g, REDACTED);
  return out;
}
