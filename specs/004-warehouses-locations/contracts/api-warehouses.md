# API Contract — 004-warehouses-locations

Extends [001 api-v1](../../001-overview/contracts/api-v1.md). Schemas:
`packages/shared/src/contracts/{warehouses,transfers}.ts`.

New errors: `NOT_A_BIN` (409), `LOCATION_NOT_EMPTY` (409, `details.holdings`),
`CODE_LOCKED` (409), `LEVELS_LOCKED` (409), `TRANSFER_STATE` (409).

| Method & path | Permission | Notes |
| --- | --- | --- |
| GET/POST `/api/v1/warehouses`, GET/PATCH `/…/{id}` | view: scoped; write: `warehouses.manage` (Admin) | levels in body: `levels: ["Aisle","Row","Box"]` |
| GET `/api/v1/warehouses/{id}/locations?parentId=&q=` | scoped | tree browse + code search |
| POST `/api/v1/warehouses/{id}/locations` | `locations.manage` (Admin, assigned SM) | single: `{ parentId, segment }` |
| POST `/api/v1/warehouses/{id}/locations/bulk/preview` → `{ create: n, skip: [codes] }`; POST `/…/bulk` | same | `{ ranges: [{ from:"A", to:"A" }, { from:1, to:3 }, { from:1, to:2 }] }` |
| PATCH `/api/v1/locations/{id}` | same | rename segment (code rebuilt only if no stock ever), deactivate |
| POST `/api/v1/stock/moves` | `stock.move` scoped | `{ itemId, pieceId?, fromLocationId, toLocationId, quantity, unit, condition }` |
| GET `/api/v1/warehouses/{id}/bin-suggestions?itemId=` | scoped | usual bins first |
| GET/POST `/api/v1/transfers`, GET `/…/{id}` | `transfers.manage` | |
| POST `/api/v1/transfers/{id}/dispatch` | SM of source | `{ lines: [{ lineId, dispatchedQty, fromLocationId }] }` |
| POST `/api/v1/transfers/{id}/receive` | SM of destination | `{ lines: [{ lineId, receivedQty, toLocationId }], confirmMissing: true }` |
| POST `/api/v1/transfers/{id}/lines/{lineId}/shortfall` | Admin | `{ decision: "lost" | "returned", note }` |
| POST `/api/v1/transfers/{id}/cancel` | requester or Admin | only `requested` |
