-- 005-event-planning (data-model.md): events, assignments, lines with sources, over-booking warnings.

CREATE TABLE event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  status item_status NOT NULL DEFAULT 'active',
  position integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX event_types_name ON event_types (lower(name));
INSERT INTO event_types (name, position) VALUES
  ('Wedding', 1), ('Engagement or Reception', 2), ('Birthday or Private party', 3), ('Corporate event', 4),
  ('Conference or Exhibition', 5), ('Concert or Cultural show', 6), ('Political rally or Public meeting', 7),
  ('Religious or Community function', 8), ('Other', 9);

CREATE TYPE event_status AS ENUM ('draft', 'scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling', 'closed', 'cancelled');

-- A Draft may miss any field (005 US1-1); scheduling checks completeness. No client fields (Q5).
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 150),
  type_id uuid REFERENCES event_types(id),
  description text NOT NULL DEFAULT '',
  venue_name text NOT NULL DEFAULT '',
  venue_address text NOT NULL DEFAULT '',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  place_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  leave_warehouse_at timestamptz,
  expected_return_date date,
  site_contact_name text NOT NULL DEFAULT '',
  site_contact_phone_e164 text,
  notes text NOT NULL DEFAULT '',
  status event_status NOT NULL DEFAULT 'draft',
  -- First scheduled keeps its stock: over-booking warnings go to events scheduled later (US2).
  scheduled_at timestamptz,
  cancelled_reason text,
  cancelled_by uuid REFERENCES users(id),
  cancelled_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  CHECK (leave_warehouse_at IS NULL OR starts_at IS NULL OR leave_warehouse_at <= starts_at)
);
CREATE INDEX events_window ON events (leave_warehouse_at, expected_return_date) WHERE status NOT IN ('draft', 'cancelled', 'closed');

CREATE TABLE event_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role_on_event text NOT NULL CHECK (role_on_event IN ('event_manager', 'store_manager')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
CREATE UNIQUE INDEX event_assignments_current ON event_assignments (event_id, user_id, role_on_event) WHERE removed_at IS NULL;

CREATE TABLE event_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  item_id uuid NOT NULL REFERENCES items(id),
  planned_qty numeric(14, 3) NOT NULL CHECK (planned_qty > 0),
  round integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT ''
);
CREATE INDEX event_lines_event ON event_lines (event_id);
CREATE INDEX event_lines_item ON event_lines (item_id);

-- A line's quantity comes from warehouses, or from an earlier event by direct handover (clarification).
CREATE TABLE event_line_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_line_id uuid NOT NULL REFERENCES event_lines(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('warehouse', 'event')),
  warehouse_id uuid REFERENCES warehouses(id),
  source_event_id uuid REFERENCES events(id),
  planned_qty numeric(14, 3) NOT NULL CHECK (planned_qty > 0),
  reserved_qty numeric(14, 3) NOT NULL DEFAULT 0,
  CHECK ((source_type = 'warehouse') = (warehouse_id IS NOT NULL)),
  CHECK ((source_type = 'event') = (source_event_id IS NOT NULL))
);
CREATE INDEX event_line_sources_line ON event_line_sources (event_line_id);
CREATE INDEX event_line_sources_source_event ON event_line_sources (source_event_id) WHERE source_event_id IS NOT NULL;

-- One active warning per event, item and source (warehouse or source event).
CREATE TABLE overbooking_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  item_id uuid NOT NULL REFERENCES items(id),
  warehouse_id uuid REFERENCES warehouses(id),
  source_event_id uuid REFERENCES events(id),
  shortfall_qty numeric(14, 3) NOT NULL,
  clashing_event_ids uuid[] NOT NULL DEFAULT '{}',
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  last_notified_at timestamptz
);
CREATE UNIQUE INDEX overbooking_active ON overbooking_warnings (
  event_id, item_id, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'), COALESCE(source_event_id, '00000000-0000-0000-0000-000000000000')
) WHERE resolved_at IS NULL;

-- Reminders are idempotent per event, kind and IST day (research R7).
CREATE TABLE event_reminders (
  event_id uuid NOT NULL REFERENCES events(id),
  kind text NOT NULL,
  day date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, kind, day)
);

ALTER TABLE stock_balances ADD CONSTRAINT stock_balances_event_fk FOREIGN KEY (event_id) REFERENCES events(id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_from_event_fk FOREIGN KEY (from_event_id) REFERENCES events(id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_to_event_fk FOREIGN KEY (to_event_id) REFERENCES events(id);
