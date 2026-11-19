# API Contract — 003-catalogue-inventory

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/{catalogue,stock}.ts`. Quantities are decimal strings with a
`unit` code; money is integer paise.

## New error codes
`INSUFFICIENT_STOCK` (409, `details: { itemId, locationId, condition, available }`),
`CODE_TAKEN` (409), `TRACKING_TYPE_LOCKED` (409), `IN_USE` (409, archive instead),
`IMPORT_HAS_ERRORS` (409).

## Catalogue (write: `catalogue.manage` — Admin; read: `catalogue.view`)
| Method & path | Notes |
| --- | --- |
| GET/POST `/api/v1/catalogue/categories`, PATCH `/…/{id}` | archive via `status` |
| GET/POST `/api/v1/catalogue/units`, PATCH `/…/{code}` | |
| GET `/api/v1/catalogue/items?q=&categoryId=&warehouseId=&condition=&belowMinimum=&cursor=` | `q` matches name and any code ever |
| POST `/api/v1/catalogue/items` | `{ name, code?, categoryId, description?, trackingType, unitCode?, replacementValuePaise, minimumStock?, minimumUsableLength?, notes? }` |
| GET `/api/v1/catalogue/items/{id}` | Item view: item, codes history, photos (signed URLs), balances by condition and location, pieces, lastUsedIn, upcoming reservations, damage summary |
| PATCH `/api/v1/catalogue/items/{id}` | incl. `code` change → audit + history |
| POST `/api/v1/catalogue/items/{id}/photos/upload-url` → `{ url, key }`; POST `/…/photos` `{ key }` | |

## Stock (`stock.view`, `stock.move`, `stock.approve`)
| Method & path | Notes |
| --- | --- |
| GET `/api/v1/stock/movements?itemId=&locationId=&type=&from=&to=&cursor=` | ledger |
| POST `/api/v1/stock/opening` | `{ lines: [{ itemId, pieceId?, locationId, condition, quantity, unit }] }` |
| POST `/api/v1/stock/cuts` | `{ pieceId, length, unit }` → `{ cutPiece, offcut }` |
| POST `/api/v1/stock/corrections` | Store Manager → pending request; Admin → applied immediately |
| POST `/api/v1/stock/write-offs` | always a request; Admin approves |
| POST `/api/v1/stock/requests/{id}/approve` \| `/reject` | `stock.approve` (Admin) |
| POST `/api/v1/stock/return-to-available` | damaged → available with reason |

## Imports (`imports.run`)
| POST `/api/v1/imports` (multipart: kind, file) → preview | POST `/api/v1/imports/{id}/commit` | GET `/api/v1/imports/templates/{kind}` (xlsx) |

## Internal service API (server-only, used by 004–007)
`postMovements(tx, movements[])`, `reserve(tx, eventLineId, …)`, `release(…)`,
`balancesFor(itemId, window?)` — not HTTP.
