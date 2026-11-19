-- 007-physical-count (data-model.md): schedules, sessions with a snapshot, lines with decisions.

CREATE TABLE count_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  start_date date NOT NULL,
  next_due_date date NOT NULL,
  blind boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No rows = all warehouses / all categories.
CREATE TABLE count_schedule_scope (
  schedule_id uuid NOT NULL REFERENCES count_schedules(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id),
  category_id uuid REFERENCES categories(id),
  CHECK ((warehouse_id IS NULL) <> (category_id IS NULL))
);
CREATE TABLE count_schedule_assignees (
  schedule_id uuid NOT NULL REFERENCES count_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (schedule_id, user_id)
);

CREATE TABLE count_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  schedule_id uuid REFERENCES count_schedules(id),
  due_date date NOT NULL,
  blind boolean NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'in_review', 'completed')),
  scope jsonb NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_movement_id bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id),
  submitted_by uuid REFERENCES users(id),
  submitted_at timestamptz,
  completed_at timestamptz
);
-- One session per schedule and due date, however often the job runs (research R2).
CREATE UNIQUE INDEX count_sessions_once ON count_sessions (schedule_id, due_date) WHERE schedule_id IS NOT NULL;

CREATE TABLE count_session_assignees (
  session_id uuid NOT NULL REFERENCES count_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE count_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES count_sessions(id),
  item_id uuid NOT NULL REFERENCES items(id),
  piece_id uuid REFERENCES item_pieces(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  condition stock_condition NOT NULL CHECK (condition IN ('available', 'reserved', 'damaged')),
  recorded_qty numeric(14, 3) NOT NULL DEFAULT 0,
  counted_qty numeric(14, 3) CHECK (counted_qty IS NULL OR counted_qty >= 0),
  photo_key text,
  note text NOT NULL DEFAULT '',
  counted_by uuid REFERENCES users(id),
  counted_at timestamptz,
  added_by_counter boolean NOT NULL DEFAULT false,
  decision text CHECK (decision IN ('matched', 'pending', 'approved', 'rejected', 'recount')),
  decision_reason text,
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  movement_id bigint REFERENCES stock_movements(id),
  recounts integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX count_lines_key ON count_lines (session_id, item_id, COALESCE(piece_id, '00000000-0000-0000-0000-000000000000'), location_id, condition);

-- Daily overdue escalation, once per session and IST day (research R6).
CREATE TABLE count_escalations (
  session_id uuid NOT NULL REFERENCES count_sessions(id),
  day date NOT NULL,
  PRIMARY KEY (session_id, day)
);
