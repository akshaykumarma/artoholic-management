-- 006-event-checklists (data-model.md): rounds, the four steps, entries, damage reports, corrections.

CREATE TABLE dispatch_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  round integer NOT NULL CHECK (round >= 1),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, round)
);

CREATE TYPE checklist_step_type AS ENUM ('warehouse_dispatch', 'site_receipt', 'return_dispatch', 'warehouse_receipt');

CREATE TABLE checklist_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES dispatch_rounds(id),
  step checklist_step_type NOT NULL,
  warehouse_id uuid REFERENCES warehouses(id),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted')),
  version integer NOT NULL DEFAULT 1,
  submitted_by uuid REFERENCES users(id),
  submitted_at timestamptz,
  client_platform client_platform,
  client_version text,
  device_label text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  vehicle_number text,
  driver_name text,
  driver_phone_e164 text,
  CHECK ((step IN ('warehouse_dispatch', 'warehouse_receipt')) = (warehouse_id IS NOT NULL))
);
CREATE UNIQUE INDEX checklist_steps_unique ON checklist_steps (round_id, step, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'));

-- One row per step and line source; only the columns relevant to the step are used.
CREATE TABLE checklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES checklist_steps(id),
  event_line_source_id uuid NOT NULL REFERENCES event_line_sources(id),
  piece_id uuid REFERENCES item_pieces(id),
  done boolean NOT NULL DEFAULT false,
  qty_dispatched numeric(14, 3),
  qty_received numeric(14, 3),
  qty_returned numeric(14, 3),
  qty_handed_over numeric(14, 3),
  handover_event_id uuid REFERENCES events(id),
  qty_consumed numeric(14, 3),
  qty_damaged numeric(14, 3),
  qty_missing numeric(14, 3),
  remaining_length numeric(14, 3),
  short_reason text CHECK (short_reason IN ('out_of_stock', 'damaged_on_pick', 'admin_decision', 'other')),
  note text NOT NULL DEFAULT '',
  bin_location_id uuid REFERENCES locations(id),
  photo_keys text[] NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, event_line_source_id)
);

CREATE TABLE damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  event_id uuid NOT NULL REFERENCES events(id),
  event_line_source_id uuid NOT NULL REFERENCES event_line_sources(id),
  step_id uuid NOT NULL REFERENCES checklist_steps(id),
  entry_id uuid NOT NULL REFERENCES checklist_entries(id),
  kind text NOT NULL CHECK (kind IN ('damaged', 'missing')),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  reason text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  reported_by uuid NOT NULL REFERENCES users(id),
  reported_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  decision_comment text,
  movement_id bigint REFERENCES stock_movements(id),
  -- A rejected report is superseded when the reporter re-checks the line (US3-2).
  resolved_by_recheck_at timestamptz,
  photos_deleted_at timestamptz
);
CREATE INDEX damage_reports_event ON damage_reports (event_id);
CREATE INDEX damage_reports_pending ON damage_reports (status) WHERE status = 'pending';

-- Damage photos are deleted 6 months after the decision; the report itself is kept forever (Q12).
CREATE TABLE damage_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_report_id uuid NOT NULL REFERENCES damage_reports(id),
  storage_key text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by uuid REFERENCES users(id),
  bytes integer,
  delete_after timestamptz,
  deleted_at timestamptz
);

CREATE TABLE handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giving_event_id uuid NOT NULL REFERENCES events(id),
  receiving_event_id uuid NOT NULL REFERENCES events(id),
  item_id uuid NOT NULL REFERENCES items(id),
  giving_entry_id uuid NOT NULL REFERENCES checklist_entries(id),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  event_line_source_id uuid NOT NULL REFERENCES event_line_sources(id),
  field text NOT NULL CHECK (field IN ('returned', 'consumed', 'lost', 'damaged')),
  old_value numeric(14, 3) NOT NULL,
  new_value numeric(14, 3) NOT NULL,
  reason text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES users(id),
  corrected_at timestamptz NOT NULL DEFAULT now(),
  movement_id bigint REFERENCES stock_movements(id)
);

ALTER TABLE events ADD COLUMN closed_by uuid REFERENCES users(id), ADD COLUMN closed_at timestamptz;
