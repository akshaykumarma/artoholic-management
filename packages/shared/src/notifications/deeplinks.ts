/**
 * Deep links (008 research R2): notifications carry the web path; the phone app maps it to its own
 * screens. Unknown paths open the notification centre.
 */
const RULES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^\/events\/([\w-]+)\/checklists\/([\w-]+)$/, (m) => `/checklist/${m[2]}?eventId=${m[1]}`],
  [/^\/events\/([\w-]+)(\/.*)?$/, (m) => `/events/${m[1]}`],
  [/^\/approvals\/damage\/([\w-]+)$/, (m) => `/approvals/damage/${m[1]}`],
  [/^\/approvals$/, () => '/approvals'],
  [/^\/counts\/([\w-]+)(\/review)?$/, (m) => `/counts/${m[1]}`],
  [/^\/inventory\/items\/([\w-]+)$/, (m) => `/inventory/${m[1]}`],
  [/^\/inventory\/approvals$/, () => '/approvals'],
  [/^\/warehouses\/transfers\/([\w-]+)$/, (m) => `/warehouses/transfers/${m[1]}`]
];

export function mobilePath(webPath: string | null | undefined): string {
  if (!webPath) return '/notifications';
  for (const [re, to] of RULES) {
    const m = webPath.match(re);
    if (m) return to(m);
  }
  return '/notifications';
}
