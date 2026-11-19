import { formatDateTimeIST, formatDateIST, formatPlainDate } from './datetime';
import { formatMoney } from './money';
import { formatQuantity } from './quantity';
import { formatPhone } from './phone';
import { formatRecordNumber } from './record-number';

/**
 * The reference sample set shown on every app's "Display conventions" screen (US2, SC-002).
 * Each app renders the same list, so outputs can be compared side by side.
 */
export const CONVENTION_SAMPLES = [
  { id: 'dt', label: 'formatDateTimeIST(2026-11-19T18:30:00Z)', render: () => formatDateTimeIST('2026-11-19T18:30:00Z') },
  { id: 'date', label: 'formatDateIST(2026-12-31T18:30:00Z)', render: () => formatDateIST('2026-12-31T18:30:00Z') },
  { id: 'plain', label: 'formatPlainDate(2026-11-20)', render: () => formatPlainDate('2026-11-20') },
  { id: 'money', label: 'formatMoney(123456750 paise)', render: () => formatMoney(123456750) },
  { id: 'neg', label: 'formatMoney(-120000 paise)', render: () => formatMoney(-120000) },
  { id: 'qty', label: 'formatQuantity(12.500, m)', render: () => formatQuantity('12.500', 'm') },
  { id: 'count', label: 'formatQuantity(40)', render: () => formatQuantity('40') },
  { id: 'phone', label: 'formatPhone(+919876543210)', render: () => formatPhone('+919876543210') },
  { id: 'evt', label: 'formatRecordNumber(event, 2026, 1)', render: () => formatRecordNumber('event', 2026, 1) },
  { id: 'itm', label: 'formatRecordNumber(item, 1)', render: () => formatRecordNumber('item', 0, 1) }
] as const;
