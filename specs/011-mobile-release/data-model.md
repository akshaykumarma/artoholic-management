# Data Model: 011-mobile-release

## app_releases
`id`, `platform` (`android`, `ios`), `version` (semver), `build_number` (increasing per
platform), `notes`, `store_status` (`internal`, `in_review`, `live`, `rejected`),
`rejection_reason`, `created_at`, `live_at`.

## release_checks
`release_id`, `check_key` (sign-in, menu, dispatch, receipt-photo, damage-approval, count-entry,
push, update-prompt), `passed`, `tested_by`, `device`, `at`.

## account_deletion_requests
`id`, `user_id`, `requested_at`, `status` (`pending`, `completed`, `withdrawn`),
`completed_by`, `completed_at`, `due_at` (requested + 30 days).

## users (extended)
Uses 002's `pseudonymised_at`.
