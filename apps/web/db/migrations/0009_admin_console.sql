-- 010-admin-console (data-model.md).

CREATE TABLE company_profile (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Artoholic',
  tagline text NOT NULL DEFAULT 'Redefining your event through art.',
  logo_key text,
  gstin text CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  address text NOT NULL DEFAULT '',
  phone_e164 text,
  email text,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO company_profile (id) VALUES (1);

CREATE TABLE master_list_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list text NOT NULL CHECK (list IN ('damage_reason', 'short_dispatch_reason')),
  value text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 80),
  position integer NOT NULL DEFAULT 0,
  status item_status NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX master_list_values_unique ON master_list_values (list, lower(value));
INSERT INTO master_list_values (list, value, position) VALUES
  ('damage_reason', 'Broken in transit', 1), ('damage_reason', 'Damaged at venue', 2), ('damage_reason', 'Stained or torn', 3), ('damage_reason', 'Other', 9),
  ('short_dispatch_reason', 'Out of stock', 1), ('short_dispatch_reason', 'Damaged on pick', 2), ('short_dispatch_reason', 'Admin decision', 3), ('short_dispatch_reason', 'Other', 9);

CREATE TABLE backup_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  database_bytes bigint,
  files_synced integer,
  location text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  error text
);

CREATE TABLE restore_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_at timestamptz NOT NULL,
  performed_by uuid NOT NULL REFERENCES users(id),
  backup_record_id uuid REFERENCES backup_records(id),
  observed_rpo_hours numeric(6, 2),
  observed_rto_hours numeric(6, 2),
  result text NOT NULL CHECK (result IN ('passed', 'failed')),
  notes text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule text NOT NULL CHECK (rule IN ('damage_photos', 'ledger_rollup', 'audit_archive')),
  ran_at timestamptz NOT NULL DEFAULT now(),
  removed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'blocked')),
  detail text NOT NULL DEFAULT ''
);

-- Archives keep rows older than 3 years out of the live tables (legal hold, not shown in the app).
CREATE TABLE stock_movements_archive (LIKE stock_movements INCLUDING DEFAULTS);
CREATE TABLE audit_entries_archive (LIKE audit_entries INCLUDING DEFAULTS);

-- Reminders sent by the console (restore test due), once per day.
CREATE TABLE console_reminders (kind text NOT NULL, day date NOT NULL, PRIMARY KEY (kind, day));

-- 010 US4: more import kinds.
ALTER TABLE import_batches DROP CONSTRAINT import_batches_kind_check;
ALTER TABLE import_batches ADD CONSTRAINT import_batches_kind_check CHECK (kind IN ('items', 'opening_stock', 'users', 'categories', 'locations'));

-- 010 US6: rolled-up ledger rows move to the archive, so references to movements become soft
-- (they point at stock_movements or stock_movements_archive by id).
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_corrects_movement_id_fkey;
ALTER TABLE correction_requests DROP CONSTRAINT IF EXISTS correction_requests_movement_id_fkey;
ALTER TABLE damage_reports DROP CONSTRAINT IF EXISTS damage_reports_movement_id_fkey;
ALTER TABLE event_corrections DROP CONSTRAINT IF EXISTS event_corrections_movement_id_fkey;
ALTER TABLE count_lines DROP CONSTRAINT IF EXISTS count_lines_movement_id_fkey;
