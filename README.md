# Artoholic Management

Event operations platform for Artoholic: inventory (including cut products), warehouses with
user-defined storage locations, and event management with dispatch / receipt checklists, photo
damage approval and scheduled reports. One API serves a web app, an Android app and an iOS app.

- Requirements: [`docs/PRD-v1.1-source.md`](docs/PRD-v1.1-source.md) (owner's original draft:
  `docs/owner-draft-PRD-BRD.docx`)
- Governance: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- Stack: Next.js + PostgreSQL (Drizzle) + pg-boss + S3-compatible storage + Docker; React Native
  (Expo) for mobile

## How features are built

Spec-driven development with Spec-Kit, one feature at a time, in the order of PRD §14.2
(`001-overview` … `011-mobile-release`):

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`
→ `/speckit-implement`
