import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Normalises a typed phone number to E.164, defaulting to India (+91) when no country code is
 * given: "98765 43210", "+91-98765-43210", "09876543210" → "+919876543210". Returns null if it
 * is not a valid number.
 */
export function normalisePhone(input: string): string | null {
  const cleaned = input.trim();
  if (!/^[+\d(][\d\s().+-]{5,}$/.test(cleaned)) return null;
  const parsed = parsePhoneNumberFromString(cleaned.replace(/[()]/g, ''), 'IN');
  return parsed && parsed.isValid() ? parsed.number : null;
}
