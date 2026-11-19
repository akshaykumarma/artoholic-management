# Data Model: 002-auth-rbac

Extends 001's tables. UTC timestamps; UUID keys.

## users (extended)

| Column | Change | Rules |
| --- | --- | --- |
| phone_e164 | now `NOT NULL UNIQUE` | E.164; own number per account (clarification) |
| email | unchanged | optional, unique, citext |
| username | unchanged | unique; MUST NOT equal any user's email or phone |
| must_change_password | new boolean | true on creation, admin reset, reactivation |
| password_changed_at | new timestamptz | |
| deactivated_at, deactivated_by | new | set on deactivation |
| pseudonymised_at | new timestamptz | set by deletion requests (011) |

Validation: full name 1–120; username 3–120 `[A-Za-z0-9._@+-]`; password policy FR-009.

## user_roles (unchanged from 001)

Roles: `super_admin` (exactly one), `admin`, `event_manager`, `store_manager`.

## warehouse_assignments (new)

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK users | user must hold `store_manager` |
| warehouse_id | uuid FK warehouses | FK added in 004; nullable-free from 004 on |
| assigned_at, assigned_by | | |
| unassigned_at, unassigned_by | nullable | history kept; active = `unassigned_at IS NULL` |

Unique active (`user_id`, `warehouse_id`) where `unassigned_at IS NULL`. Removing the
`store_manager` role closes all active assignments.

## password_resets (new)

| Column | Type | Rules |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK users | |
| code_hmac | bytea | HMAC-SHA256(code) |
| channels | text[] | `whatsapp`, `email` |
| requested_at | timestamptz | |
| expires_at | timestamptz | requested_at + 10 min |
| attempts | smallint | ≤ 5 |
| used_at | timestamptz | nullable |
| network_address | inet | |

## sessions (extended)

| Column | Change |
| --- | --- |
| biometric_enabled | new boolean, mobile only |

## State: user status

`active` → `deactivated` (by Admin; revokes sessions) → `active` (reactivation; sets
`must_change_password`). Never deleted.
