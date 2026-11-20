# Implementation progress and recovery log

## Current state (2026-11-19)

Prisma is upgraded to 7.10.1 with the PostgreSQL driver adapter. The root `dev` command starts API, collaboration, and web services. Prisma config loads the root `.env` when commands run from `packages/db`. The initial migration is applied to the configured Neon database. Full tests, typecheck, build, formatting, and lint have passed; remaining work includes snapshots/restore, multi-instance runtime acceptance, production deployment, and final product coverage.

The latest UI pass aligns the page view to the top of the workspace grid, hides workspace administration forms while a page is open, and adds a direct return to workspace overview. Inline auth/workspace errors are now toast notifications, with loading indicators for workspace/page/member/comment data, the editor, and mutations. Typecheck, build, formatting, and lint passed after these changes; tests were not rerun for this UI pass.

## Recovery findings

- npm workspaces and lockfile are present. The initial repo had auth/workspace APIs, Prisma schema/migration/seed, shared Zod contracts, and ADRs 001–006; editor/collaboration packages were subsequently added.
- Docker daemon access was denied; escalated Compose inspection/start attempts did not return service output. No service status can be claimed.
- `.env` was not read or modified. Process inspection was denied. Git started with all project files untracked; changes remain uncommitted.
- Package registry access succeeded for dependency installation via an approved network run. The install reported 33 advisories (29 moderate, 2 high, 2 critical); `npm audit` could not retrieve details because registry DNS failed.
- ESLint is configured at the root. Lint exits 0 with six warnings (three dependency-array warnings, two Fast Refresh warnings, one stale disable directive).
- `npm run dev` starts all three apps; during smoke check the web server chose port 3001 because port 3000 was already occupied. API development CORS now allows loopback hosts on arbitrary ports; production still uses the configured exact origin.
- Neon was reachable. The initial migration was applied, and a subsequent deploy reported no pending migrations.
- Prisma 7 runtime clients and the seed runner use `@prisma/adapter-pg`.

## Verification results

| Command                                                | Result                                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                    | Passed after Prisma 7 and root environment loader updates.                                                                                                    |
| `npm run build`                                        | Passed after Prisma 7 update. Web bundle warning: main chunk exceeds 500 kB.                                                                                  |
| `npm run format:check`                                 | Passed after formatting latest documentation and test changes.                                                                                                |
| `npm run lint`                                         | Passed with zero errors and six warnings.                                                                                                                     |
| `npm run db:generate`                                  | Passed; Prisma Client v7.10.1 generated.                                                                                                                      |
| `bunx prisma validate` (from `packages/db`)            | Passed; config loads the workspace root `.env`.                                                                                                               |
| `bunx prisma migrate deploy` (from `packages/db`)      | Applied `20261119090318_init` to Neon; later deploy reported no pending migrations.                                                                           |
| `npm run --workspace=@collab/contracts test`           | Passed: 8 tests.                                                                                                                                              |
| `npm run --workspace=@collab/web test -- --pool=forks` | Passed: 2 auth form tests; Vite logged sandbox `EPERM` for a temporary WebSocket bind.                                                                        |
| `npm run --workspace=@collab/collaboration test`       | Passed: 2 Yjs convergence/state roundtrip tests.                                                                                                              |
| `npm test`                                             | Passed: 50 tests total (contracts 8, database 5, API 33 including four CORS checks, collaboration 2, web 2). API hooks use a longer timeout for Neon latency. |
| `npm audit`                                            | Could not fetch the audit endpoint due to DNS/network failure; install reported 33 advisories but package details are unavailable.                            |
| `docker compose ps` / `up`                             | Daemon socket permission denied; escalated attempts yielded no status.                                                                                        |

## Phase status

| Phase                       | Status                  | Evidence / remaining work                                                                                                                          |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Discovery                 | Incomplete verification | ADRs and plan exist; original baseline is untracked.                                                                                               |
| 1 Foundation                | Incomplete              | Workspaces, configs, root dev scripts, env schema, Compose, CI, ESLint, and formatting exist; Compose/CI unavailable and six lint warnings remain. |
| 2 Database                  | In progress             | Prisma 7.10.1 migration applied to Neon; DB constraint/binary tests pass. Seed rerun and fresh-database checks remain.                             |
| 3 Authentication            | In progress             | HTTP-only cookies, active-session checks, and API tests pass; CSRF/refresh lifecycle review remains.                                               |
| 4 Workspaces                | In progress             | REST/UI, email-bound invitations, serializable owner protections and API tests pass; UI journey review remains.                                    |
| 5 Pages/permissions         | In progress             | Page hierarchy, permission, cycle, and comment API tests pass; editor/UI end-to-end verification remains.                                          |
| 6 Editor                    | In progress             | Tiptap collaborative editor/toolbar implemented; serialization/import and component tests remain.                                                  |
| 7 Collaboration/persistence | In progress             | Authenticated Hocuspocus, page permission/session checks, Prisma Yjs state persistence and Yjs unit tests; DB runtime recovery test remains.       |
| 8 Presence                  | In progress             | Awareness, remote cursors, user identity/color and presence count implemented; runtime test remains.                                               |
| 9 Comments                  | In progress             | Comment API/panel and authored tests; editor-selection anchoring/optimistic update and API test execution remain.                                  |
| 10 Snapshots                | Not started             | Snapshot endpoints/UI/restore are absent.                                                                                                          |
| 11 Redis scaling            | In progress             | Hocuspocus Redis extension configured; two-server update/presence test and resilience verification remain.                                         |
| 12 Product polish           | In progress             | Compact page layout, toast notifications, and async loading feedback added; accessibility, search, and end-to-end acceptance remain.               |
| 13 Hardening                | In progress             | Input/auth checks and graceful shutdown exist; lint, full security review, performance work and tests remain.                                      |
| 14 Acceptance               | Not started             | Full integration and E2E suite awaits working DB/socket access.                                                                                    |
| 15 Delivery                 | In progress             | Setup/API/architecture docs drafted; production Dockerfiles, deployment, verified demo and final evidence remain.                                  |

## Next steps

1. Implement snapshot list/create/preview/restore with forward CRDT updates and UI.
2. Verify Yjs persistence recovery, revocation, and Redis updates/presence across two collaboration servers.
3. Finish accessibility/search, security review, production packaging/deployment, demo, and final acceptance evidence.

See `docs/decisions/001-rest-vs-collab.md` through `docs/decisions/006-snapshots.md` for architectural rationale.
