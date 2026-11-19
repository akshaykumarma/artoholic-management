-- 009-reports-dashboard (data-model.md).

CREATE TABLE report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL CHECK (report_id ~ '^R([1-9]|10)$'),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  weekday integer CHECK (weekday BETWEEN 1 AND 7),
  month_day integer CHECK (month_day BETWEEN 1 AND 31),
  time_ist text NOT NULL CHECK (time_ist ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (frequency <> 'weekly' OR weekday IS NOT NULL),
  CHECK (frequency <> 'monthly' OR month_day IS NOT NULL)
);

-- Admins only (owner decision Q13).
CREATE TABLE report_schedule_recipients (
  schedule_id uuid NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (schedule_id, user_id)
);

CREATE TABLE report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL,
  schedule_id uuid REFERENCES report_schedules(id) ON DELETE SET NULL,
  run_date date,
  requested_by uuid REFERENCES users(id),
  filters jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  row_count integer,
  file_key text,
  file_name text,
  file_bytes integer,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  error text
);
-- A scheduled report runs once per IST day, however often the job ticks (research R3).
CREATE UNIQUE INDEX report_runs_once ON report_runs (schedule_id, run_date) WHERE schedule_id IS NOT NULL;
