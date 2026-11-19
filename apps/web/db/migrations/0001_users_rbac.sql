-- 002-auth-rbac (data-model.md). Extends 001's users and sessions.
ALTER TABLE users
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN password_changed_at timestamptz,
  ADD COLUMN deactivated_at timestamptz,
  ADD COLUMN deactivated_by uuid REFERENCES users(id),
  ADD COLUMN pseudonymised_at timestamptz;

-- Store Managers × warehouses, with history (FK to warehouses is added in 004).
CREATE TABLE warehouse_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  warehouse_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES users(id),
  unassigned_at timestamptz,
  unassigned_by uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX warehouse_assignments_active ON warehouse_assignments (user_id, warehouse_id) WHERE unassigned_at IS NULL;
CREATE INDEX warehouse_assignments_warehouse ON warehouse_assignments (warehouse_id) WHERE unassigned_at IS NULL;

CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  code_hmac bytea NOT NULL,
  channels text[] NOT NULL,
  requested_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  used_at timestamptz,
  network_address inet
);
CREATE INDEX password_resets_user ON password_resets (user_id, requested_at);
CREATE INDEX password_resets_addr ON password_resets (network_address, requested_at);

ALTER TABLE sessions ADD COLUMN biometric_enabled boolean NOT NULL DEFAULT false;

-- Development stand-in for WhatsApp/email delivery until 008 ships the real channels.
CREATE TABLE dev_outbox (
  id bigserial PRIMARY KEY,
  channel text NOT NULL,
  to_address text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
