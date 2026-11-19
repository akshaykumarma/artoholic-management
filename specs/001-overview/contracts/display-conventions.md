# Display Conventions Contract — 001-overview

Implemented once in `packages/shared/format/` and used by web, mobile, exports and messages.
These sample values are the reference set for SC-002: each app's reference sample screen and the
unit tests MUST produce exactly the "Output" column.

| Function | Input | Output |
| --- | --- | --- |
| `formatDateTimeIST` | `2026-11-19T18:30:00Z` | `20-11-2026 00:00 IST` |
| `formatDateTimeIST` | `2026-12-31T18:29:59Z` | `31-12-2026 23:59 IST` |
| `formatDateIST` (from instant) | `2026-12-31T18:30:00Z` | `01-01-2027` |
| `formatPlainDate` (calendar date, no shift) | `2026-11-20` | `20-11-2026` |
| `istYear` | `2026-12-31T18:30:00Z` | `2027` |
| `formatMoney` (paise) | `123456750` | `₹12,34,567.50` |
| `formatMoney` | `0` | `₹0.00` |
| `formatMoney` | `-120000` | `−₹1,200.00` (U+2212 minus) |
| `formatMoney` | `10000000` | `₹1,00,000.00` |
| `formatQuantity` | `"12.500"`, unit `m` | `12.5 m` |
| `formatQuantity` | `"40"`, no unit | `40` |
| `formatQuantity` | `"0.125"`, unit `kg` | `0.125 kg` |
| `formatPhone` | `+919876543210` | `+91 98765 43210` |
| `formatPhone` | `+14155550123` (non-Indian) | `+14155550123` |
| `formatRecordNumber` | `event`, 2026, 1 | `EVT-2026-0001` |
| `formatRecordNumber` | `event`, 2026, 10000 | `EVT-2026-10000` |
| `formatRecordNumber` | `damage_report`, 2026, 1 | `DMG-2026-00001` |
| `formatRecordNumber` | `item`, —, 1 | `ITM-00001` |

Rules: IST = UTC + 05:30 fixed (no daylight saving); 24-hour clock; never use the device time
zone. Quantities: up to 3 decimals, trailing zeros removed, decimal input as string.
