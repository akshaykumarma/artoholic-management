# Artoholic Management

Event operations platform for Artoholic: inventory (including cut products), warehouses with
user-defined storage locations, and event management with dispatch / receipt checklists, photo
damage approval and scheduled reports. One API serves a web app, an Android app and an iOS app.

- Requirements: [`docs/PRD-v1.1-source.md`](docs/PRD-v1.1-source.md) (owner's original draft:
  `docs/owner-draft-PRD-BRD.docx`)
- Governance: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- Specs, plans and tasks: [`specs/`](specs/)

## Repository layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 14 web app **and** the versioned API (`/api/v1/*`), PostgreSQL via `pg` + Drizzle |
| `apps/mobile` | Expo (React Native) app for Android and iOS |
| `packages/shared` | Shared by both apps: API contracts (zod), API client, display conventions, module map, permissions, English strings |

## Run it locally

Prerequisites: Node.js 20+, npm 10, Docker (or a local PostgreSQL 15+).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d db minio minio-init
```

```bash
npm run db:migrate
```

```bash
SUPER_ADMIN_USERNAME=owner SUPER_ADMIN_PASSWORD='choose-a-strong-one' SUPER_ADMIN_NAME='Owner' npm run seed:super-admin
```

```bash
npm run dev:web
```

```bash
npm run dev:mobile
```

The web app runs on http://localhost:3000. For the mobile app, set `EXPO_PUBLIC_API_URL` in
`.env` to an address your phone can reach (for example your computer's LAN IP).

## Checks

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build -w @artoholic/web && npm run test:e2e
```

`npm test` needs a PostgreSQL test database (`DATABASE_URL_TEST`, default
`postgres://artoholic:artoholic@localhost:5432/artoholic_test`); the e2e suite uses
`DATABASE_URL_E2E` and resets it on every run.

## How features are built

Spec-driven development with Spec-Kit, one feature at a time, in the order of PRD §14.2
(`001-overview` … `011-mobile-release`):

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`
→ `/speckit-implement`
