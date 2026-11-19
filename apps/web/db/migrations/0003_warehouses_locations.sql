-- 004-warehouses-locations (data-model.md): layouts, bins, transfers.
ALTER TABLE warehouses
  ADD COLUMN address text NOT NULL DEFAULT '',
  ADD COLUMN latitude numeric(9, 6),
  ADD COLUMN longitude numeric(9, 6),
  ADD COLUMN place_id text,
  ADD COLUMN contact_phone_e164 text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE warehouse_levels (
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  PRIMARY KEY (warehouse_id, position)
);

-- Location tree: level 0 = the warehouse's default location; 1..N = user-defined levels; bins = level N.
ALTER TABLE locations
  ADD COLUMN parent_id uuid REFERENCES locations(id),
  ADD COLUMN level smallint NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
  ADD COLUMN segment text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX locations_code_trgm ON locations USING gin (code gin_trgm_ops);
CREATE INDEX locations_parent ON locations (parent_id);

ALTER TABLE warehouse_assignments ADD CONSTRAINT warehouse_assignments_warehouse_fk FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

CREATE TABLE transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  from_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'dispatched', 'received', 'cancelled')),
  notes text NOT NULL DEFAULT '',
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  dispatched_by uuid REFERENCES users(id),
  dispatched_at timestamptz,
  received_by uuid REFERENCES users(id),
  received_at timestamptz,
  CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE TABLE transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES transfers(id),
  item_id uuid NOT NULL REFERENCES items(id),
  piece_id uuid REFERENCES item_pieces(id),
  requested_qty numeric(14, 3) NOT NULL CHECK (requested_qty > 0),
  dispatched_qty numeric(14, 3),
  received_qty numeric(14, 3),
  missing_qty numeric(14, 3),
  from_location_id uuid REFERENCES locations(id),
  to_location_id uuid REFERENCES locations(id),
  shortfall_decision text CHECK (shortfall_decision IN ('pending', 'lost', 'returned')),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz
);

-- In-transit stock belongs to a transfer, not to any warehouse (004 SC-004).
ALTER TABLE stock_balances ADD COLUMN transfer_id uuid REFERENCES transfers(id);
DROP INDEX stock_balances_key;
CREATE UNIQUE INDEX stock_balances_key ON stock_balances (
  item_id,
  COALESCE(piece_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(location_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(event_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(transfer_id, '00000000-0000-0000-0000-000000000000'),
  condition
);
ALTER TABLE stock_movements ADD COLUMN from_transfer_id uuid REFERENCES transfers(id), ADD COLUMN to_transfer_id uuid REFERENCES transfers(id);
