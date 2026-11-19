-- 003-catalogue-inventory (data-model.md). The stock ledger every later feature writes to.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE item_status AS ENUM ('active', 'archived');
CREATE TYPE tracking_type AS ENUM ('counted', 'measured', 'cut');
CREATE TYPE stock_condition AS ENUM ('available', 'reserved', 'damaged', 'out', 'in_transit', 'lost', 'written_off', 'consumed');
CREATE TYPE movement_type AS ENUM (
  'opening', 'receipt', 'reserve', 'release', 'dispatch', 'return', 'move', 'damage', 'repair_ok', 'lost',
  'write_off', 'consume', 'cut', 'transfer_out', 'transfer_in', 'handover', 'adjustment', 'correction'
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  parent_id uuid REFERENCES categories(id),
  status item_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_per_parent ON categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), lower(name));

CREATE TABLE units (
  code text PRIMARY KEY CHECK (code ~ '^[a-z]{1,8}$'),
  name text NOT NULL,
  family text NOT NULL CHECK (family IN ('length', 'mass', 'volume')),
  factor_to_base numeric(18, 6) NOT NULL CHECK (factor_to_base > 0),
  status item_status NOT NULL DEFAULT 'active'
);
INSERT INTO units (code, name, family, factor_to_base) VALUES
  ('m', 'metre', 'length', 1), ('cm', 'centimetre', 'length', 0.01), ('mm', 'millimetre', 'length', 0.001), ('ft', 'foot', 'length', 0.3048),
  ('kg', 'kilogram', 'mass', 1), ('g', 'gram', 'mass', 0.001),
  ('l', 'litre', 'volume', 1), ('ml', 'millilitre', 'volume', 0.001);

-- Minimal warehouses and one default location each; 004 adds layouts and bins.
CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{2,8}$'),
  name text NOT NULL,
  status item_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  code text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  status item_status NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX locations_one_default ON locations (warehouse_id) WHERE is_default;

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category_id uuid NOT NULL REFERENCES categories(id),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  tracking_type tracking_type NOT NULL,
  unit_code text REFERENCES units(code),
  replacement_value_paise bigint NOT NULL DEFAULT 0 CHECK (replacement_value_paise >= 0),
  minimum_stock numeric(14, 3) CHECK (minimum_stock >= 0),
  minimum_usable_length numeric(14, 3) CHECK (minimum_usable_length >= 0),
  notes text NOT NULL DEFAULT '',
  status item_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tracking_type = 'counted') = (unit_code IS NULL)),
  CHECK (tracking_type = 'cut' OR minimum_usable_length IS NULL)
);
CREATE INDEX items_name_trgm ON items USING gin (name gin_trgm_ops);

-- Every code an item has ever had; unique across all of them (001 clarification).
CREATE TABLE item_codes (
  code citext PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id),
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to timestamptz
);
CREATE UNIQUE INDEX item_codes_one_current ON item_codes (item_id) WHERE active_to IS NULL;
CREATE INDEX item_codes_trgm ON item_codes USING gin ((code::text) gin_trgm_ops);

CREATE TABLE item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id),
  storage_key text NOT NULL UNIQUE,
  bytes integer NOT NULL CHECK (bytes > 0 AND bytes <= 10485760),
  content_type text NOT NULL,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, position)
);

CREATE TABLE item_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id),
  piece_number text NOT NULL UNIQUE,
  original_length numeric(14, 3) NOT NULL CHECK (original_length > 0),
  parent_piece_id uuid REFERENCES item_pieces(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'written_off', 'consumed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (
  id bigserial PRIMARY KEY,
  type movement_type NOT NULL,
  item_id uuid NOT NULL REFERENCES items(id),
  from_piece_id uuid REFERENCES item_pieces(id),
  to_piece_id uuid REFERENCES item_pieces(id),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  from_location_id uuid REFERENCES locations(id),
  from_event_id uuid,
  from_condition stock_condition,
  to_location_id uuid REFERENCES locations(id),
  to_event_id uuid,
  to_condition stock_condition,
  reference_type text,
  reference_id text,
  corrects_movement_id bigint REFERENCES stock_movements(id),
  reason text,
  actor_user_id uuid REFERENCES users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  client_platform client_platform,
  CHECK (from_condition IS NOT NULL OR to_condition IS NOT NULL)
);
CREATE INDEX stock_movements_item ON stock_movements (item_id, id);
CREATE INDEX stock_movements_ref ON stock_movements (reference_type, reference_id);
CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Cached balances, written only by postMovements() and rebuildable from the ledger.
CREATE TABLE stock_balances (
  id bigserial PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id),
  piece_id uuid REFERENCES item_pieces(id),
  location_id uuid REFERENCES locations(id),
  event_id uuid,
  condition stock_condition NOT NULL,
  quantity numeric(14, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0)
);
CREATE UNIQUE INDEX stock_balances_key ON stock_balances (
  item_id,
  COALESCE(piece_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(location_id, '00000000-0000-0000-0000-000000000000'),
  COALESCE(event_id, '00000000-0000-0000-0000-000000000000'),
  condition
);
CREATE INDEX stock_balances_location ON stock_balances (location_id) WHERE quantity > 0;

CREATE TABLE correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('correction', 'write_off')),
  item_id uuid NOT NULL REFERENCES items(id),
  piece_id uuid REFERENCES item_pieces(id),
  location_id uuid REFERENCES locations(id),
  condition stock_condition NOT NULL,
  quantity_change numeric(14, 3) NOT NULL CHECK (quantity_change <> 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  decision_note text,
  movement_id bigint REFERENCES stock_movements(id)
);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('items', 'opening_stock')),
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  rows jsonb NOT NULL,
  errors jsonb NOT NULL,
  status text NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed', 'committed', 'discarded')),
  committed_at timestamptz
);

-- Domain events for notifications. 008 turns these into in-app, push, WhatsApp and email messages.
CREATE TABLE notification_outbox (
  id bigserial PRIMARY KEY,
  trigger text NOT NULL,
  record_type text,
  record_id text,
  payload jsonb NOT NULL DEFAULT '{}',
  actor_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX notification_outbox_pending ON notification_outbox (id) WHERE processed_at IS NULL;
