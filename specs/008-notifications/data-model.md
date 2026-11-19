# Data Model: 008-notifications

## notification_outbox
`id`, `trigger`, `record_type`, `record_id`, `payload` jsonb, `actor_user_id`, `created_at`,
`processed_at`.

## notifications (in-app, 90 days)
`id`, `user_id`, `trigger`, `record_type`, `record_id`, `title`, `body`, `path`,
`created_at`, `read_at`, `dedupe_key`.

## messages (permanent, append-only)
`id`, `channel` (`whatsapp`, `email`), `to_address`, `user_id?`, `trigger`, `template_name`,
`language`, `rendered_text` (redacted), `attachments` jsonb (name, size, key), `record_type`,
`record_id`, `provider_message_id`, `queued_at`, `status` (latest, denormalised).

## message_events (append-only)
`id`, `message_id`, `status` (`queued`, `sent`, `delivered`, `read`, `failed`, `retrying`),
`detail`, `at`.

## channel_preferences
PK (`user_id`, `group`, `channel`), `enabled`. Groups: `events`, `damage`, `counts`, `stock`,
`reports`, `account`.

## quiet_hours
`user_id` PK, `start_minute_ist`, `end_minute_ist`, `enabled`.

## push_registrations
`id`, `user_id`, `session_id`, `platform`, `expo_token` unique, `updated_at`.

## template_mappings
PK (`trigger`, `channel`), `template_name`, `language`, `variables` jsonb, `updated_by/at`.

## provider_settings
`channel` PK, `config` jsonb (non-secret), `secret_ciphertext` bytea, `updated_by/at`.
