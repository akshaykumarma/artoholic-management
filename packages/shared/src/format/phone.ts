/** "+919876543210" → "+91 98765 43210"; other countries are shown as stored (FR-015). */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
