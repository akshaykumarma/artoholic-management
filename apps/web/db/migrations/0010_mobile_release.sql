-- 011-mobile-release (data-model.md).

CREATE TABLE app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  version text NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
  build_number integer NOT NULL CHECK (build_number > 0),
  notes text NOT NULL DEFAULT '',
  store_status text NOT NULL DEFAULT 'internal' CHECK (store_status IN ('internal', 'in_review', 'live', 'rejected')),
  rejection_reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  live_at timestamptz,
  UNIQUE (platform, build_number),
  UNIQUE (platform, version)
);

CREATE TABLE release_checks (
  release_id uuid NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
  check_key text NOT NULL CHECK (check_key IN ('sign_in', 'menu', 'dispatch', 'receipt_photo', 'damage_approval', 'count_entry', 'push', 'update_prompt')),
  passed boolean NOT NULL,
  tested_by uuid NOT NULL REFERENCES users(id),
  device text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, check_key)
);

CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'withdrawn')),
  completed_by uuid REFERENCES users(id),
  completed_at timestamptz
);
CREATE UNIQUE INDEX account_deletion_one_open ON account_deletion_requests (user_id) WHERE status = 'pending';
