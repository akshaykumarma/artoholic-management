-- 001-overview initial schema (data-model.md). All timestamps UTC.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_status AS ENUM ('active', 'deactivated');
CREATE TYPE role AS ENUM ('super_admin', 'admin', 'event_manager', 'store_manager');
CREATE TYPE client_platform AS ENUM ('web', 'android', 'ios');
CREATE TYPE mobile_platform AS ENUM ('android', 'ios');
CREATE TYPE record_kind AS ENUM ('event', 'damage_report', 'count_session', 'stock_transfer', 'item');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  username citext NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 120),
  phone_e164 text UNIQUE,
  email citext UNIQUE,
  password_hash text NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
-- Exactly one Super Admin (FR-004).
CREATE UNIQUE INDEX user_roles_one_super_admin ON user_roles (role) WHERE role = 'super_admin';

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  client_platform client_platform NOT NULL,
  client_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE sign_in_attempts (
  id bigserial PRIMARY KEY,
  username_attempted citext NOT NULL,
  user_id uuid REFERENCES users(id),
  network_address inet,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sign_in_attempts_user_idx ON sign_in_attempts (user_id, attempted_at);
CREATE INDEX sign_in_attempts_addr_idx ON sign_in_attempts (network_address, attempted_at);

CREATE TABLE audit_entries (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  client_platform client_platform,
  client_version text,
  network_address inet
);
CREATE INDEX audit_entries_time_idx ON audit_entries (occurred_at);
CREATE INDEX audit_entries_actor_idx ON audit_entries (actor_user_id, occurred_at);

-- Append-only (constitution II/V): no UPDATE or DELETE, whatever the role.
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER audit_entries_append_only BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE TABLE number_sequences (
  kind record_kind NOT NULL,
  year smallint NOT NULL,
  last_value integer NOT NULL CHECK (last_value >= 1),
  PRIMARY KEY (kind, year)
);

CREATE TABLE mobile_version_settings (
  platform mobile_platform PRIMARY KEY,
  minimum_version text NOT NULL,
  recommended_version text NOT NULL,
  store_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);
INSERT INTO mobile_version_settings (platform, minimum_version, recommended_version, store_url) VALUES
  ('android', '0.0.0', '0.0.0', 'https://play.google.com/store/apps/details?id=in.artoholic.ops'),
  ('ios', '0.0.0', '0.0.0', 'https://apps.apple.com/');

CREATE TABLE system_heartbeats (
  name text PRIMARY KEY,
  last_beat_at timestamptz NOT NULL
);
