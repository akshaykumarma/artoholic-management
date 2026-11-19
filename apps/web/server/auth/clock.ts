/** Single source of "now" for auth rules, so tests can move time and queries agree with code. */
export function now(): Date {
  return new Date();
}
