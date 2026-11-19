import { en, type MessageKey } from './en';

export type { MessageKey };

/** Looks up an English string and fills {placeholders}. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text: string = en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}
