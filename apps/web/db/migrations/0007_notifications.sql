-- 008-notifications (data-model.md). The outbox exists since 003.

-- In-app notifications, kept 90 days.
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  trigger text NOT NULL,
  record_type text,
  record_id text,
  title text NOT NULL,
  body text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dedupe_key text NOT NULL
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX notifications_dedupe ON notifications (dedupe_key, created_at DESC);

-- Every WhatsApp and email message, permanently, with redacted text (owner decision).
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  to_address text NOT NULL,
  user_id uuid REFERENCES users(id),
  trigger text NOT NULL,
  template_name text,
  language text,
  rendered_text text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]',
  record_type text,
  record_id text,
  provider_message_id text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'retrying', 'skipped'))
);
CREATE INDEX messages_record ON messages (record_type, record_id);
CREATE INDEX messages_time ON messages (queued_at DESC);
CREATE INDEX messages_provider ON messages (provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE message_events (
  id bigserial PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id),
  status text NOT NULL,
  detail text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER message_events_append_only BEFORE UPDATE OR DELETE ON message_events FOR EACH ROW EXECUTE FUNCTION forbid_change();
-- Messages themselves are never deleted; only their latest status and provider id change.
CREATE OR REPLACE FUNCTION messages_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'messages are permanent'; END IF;
  IF NEW.rendered_text <> OLD.rendered_text OR NEW.to_address <> OLD.to_address OR NEW.channel <> OLD.channel THEN
    RAISE EXCEPTION 'message content is permanent';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_permanent BEFORE UPDATE OR DELETE ON messages FOR EACH ROW EXECUTE FUNCTION messages_guard();

-- Pending deliveries (push, WhatsApp, email). Bodies are dropped once a job is finished.
CREATE TABLE channel_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('push', 'whatsapp', 'email')),
  user_id uuid REFERENCES users(id),
  message_id uuid REFERENCES messages(id),
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  payload jsonb,
  send_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channel_jobs_due ON channel_jobs (send_after) WHERE status = 'pending';

CREATE TABLE channel_preferences (
  user_id uuid NOT NULL REFERENCES users(id),
  grp text NOT NULL CHECK (grp IN ('events', 'damage', 'counts', 'stock', 'reports', 'account')),
  channel text NOT NULL CHECK (channel IN ('push', 'whatsapp', 'email')),
  enabled boolean NOT NULL,
  PRIMARY KEY (user_id, grp, channel)
);

CREATE TABLE quiet_hours (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  start_minute_ist integer NOT NULL CHECK (start_minute_ist BETWEEN 0 AND 1439),
  end_minute_ist integer NOT NULL CHECK (end_minute_ist BETWEEN 0 AND 1439),
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE push_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  platform client_platform NOT NULL,
  expo_token text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE template_mappings (
  trigger text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  variables jsonb NOT NULL DEFAULT '[]',
  body_text text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trigger, channel)
);

CREATE TABLE provider_settings (
  channel text PRIMARY KEY CHECK (channel IN ('whatsapp', 'email')),
  config jsonb NOT NULL DEFAULT '{}',
  secret_ciphertext bytea,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
