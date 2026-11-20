# Real-Time Collaborative Workspace

React, TypeScript, Express, Prisma, PostgreSQL, and Redis monorepo for a team workspace. Current code includes authentication, workspace membership, nested pages, page permissions, comments, a Tiptap/Yjs editor, and an authenticated Hocuspocus collaboration service with PostgreSQL persistence and Redis synchronization. Runtime acceptance of database and multi-client flows is still pending; see [implementation progress](IMPLEMENTATION_PROGRESS.md) for verified status and blockers.

## Requirements

- Node.js 20 or newer and npm
- Docker Desktop with Compose, for PostgreSQL and Redis

## Local setup

```sh
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate
```

Start the API, collaboration server, and web app together:

```sh
npm run dev
```

The equivalent individual commands are `npm run dev:api`, `npm run dev:collab`, and `npm run dev:web`.

Prisma 7 reads `DATABASE_URL` from the workspace root `.env` via `packages/db/prisma.config.ts`, including when commands are run from `packages/db`. For Neon, set that variable to the connection string from the Neon dashboard. Deploy migrations with `npm run db:migrate:deploy` from the workspace root, or `bunx prisma migrate deploy` from `packages/db`.

The web app runs at `http://localhost:3000`; the REST API runs at `http://localhost:4000`. Register an account to create a personal workspace. Set a unique `JWT_SECRET` of at least 32 characters before exposing the API outside local development. The example secret is for local use only.

## Checks

```sh
npm run format:check
npm run typecheck
npm test
npm run build
```

`npm run lint` runs ESLint and currently reports four non-blocking warnings. Database/API tests require PostgreSQL and local socket binding. Run the collaboration service with `npm run dev:collab`; it requires PostgreSQL and Redis.

## Documentation

- [Implementation progress and exact verification results](IMPLEMENTATION_PROGRESS.md)
- [Architecture and service boundaries](docs/architecture.md)
- [Implemented API surface](docs/api.md)
- [Database model](docs/data-model.md)
- [10-minute presentation draft](docs/presentation.md)
- [Architecture decisions](docs/decisions/)

Production container images, deployment instructions, a verified two-client demo, and acceptance evidence remain unfinished.
