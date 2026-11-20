# Collaborative Workspace - Execution Plan & Status Checklist

> **Source of Truth:** `collaborative-workspace-implementation-plan.md`  
> All phases are executed sequentially with strict verification gates, zero shortcuts, zero mocks, and production-grade implementations.

---

## Progress Summary

| Phase    | Description                                                  | Status                      | Verification Result                                                                       |
| -------- | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------- |
| Phase 0  | Repository discovery and implementation blueprint            | [~] Incomplete verification | ADRs and structure exist; see `IMPLEMENTATION_PROGRESS.md`                                |
| Phase 1  | Monorepo foundation, configuration, and developer experience | [~] In progress             | ESLint and formatting pass; Docker unavailable                                            |
| Phase 2  | Database design, Prisma, and migrations                      | [~] In progress             | Prisma 7.10.1 migration is applied to Neon; DB integration tests pass; seed rerun remains |
| Phase 3  | Authentication, sessions, and account flows                  | [~] In progress             | HTTP-only cookies and session checks pass API integration tests                           |
| Phase 4  | Workspace and membership management                          | [~] In progress             | REST/UI and email-bound invitations; live verification remains                            |
| Phase 5  | Page hierarchy, navigation, and permission model             | [~] In progress             | Page API/tree UI present; permission matrix remains                                       |
| Phase 6  | Rich-text editor and local document model                    | [~] In progress             | Tiptap editor implemented; editor tests/import remain                                     |
| Phase 7  | Yjs collaboration and durable document persistence           | [~] In progress             | Authenticated server and Prisma persistence implemented; runtime checks pending           |
| Phase 8  | Presence, avatars, and live cursors                          | [~] In progress             | Yjs awareness and remote cursor integration implemented; runtime checks pending           |
| Phase 9  | Comments and discussion                                      | [~] In progress             | API and panel exist; anchor selection and integration verification pending                |
| Phase 10 | Version history, snapshots, and restore                      | [ ] Pending                 | Not started                                                                               |
| Phase 11 | Redis and multi-instance collaboration scaling               | [~] In progress             | Hocuspocus Redis extension configured; cross-instance test pending                        |
| Phase 12 | Frontend product polish and complete user journeys           | [~] In progress             | Core workspace/page/editor journeys exist; accessibility/search/E2E remain                |
| Phase 13 | Security, reliability, and performance hardening             | [~] In progress             | Cookie/session checks, validation and shutdown present; full review remains               |
| Phase 14 | Automated testing and acceptance suite                       | [ ] Pending                 | Not started                                                                               |
| Phase 15 | Docker, deployment, demo, and final documentation            | [~] In progress             | Setup/API/architecture docs exist; deployment images and verified demo remain             |

---

## Detailed Phase Execution Checklist

### Phase 0: Repository discovery and implementation blueprint

- [x] Inspect complete repository and environment (Node.js 20.20.0, npm 10.8.2, Docker).
- [x] Establish monorepo directory layout (`apps/web`, `apps/api`, `apps/collaboration`, `packages/db`, `packages/contracts`, `packages/config`, `infra`, `docs`).
- [x] Document ADR 001: REST API vs Collaboration WebSocket responsibilities (`docs/decisions/001-rest-vs-collab.md`).
- [x] Document ADR 002: Yjs document persistence format and update strategy (`docs/decisions/002-yjs-persistence.md`).
- [x] Document ADR 003: Authentication shared between REST and WebSocket (`docs/decisions/003-shared-auth.md`).
- [x] Document ADR 004: Permission inheritance and role precedence (`docs/decisions/004-permissions.md`).
- [x] Document ADR 005: Redis pub/sub and multi-instance document synchronization (`docs/decisions/005-redis-sync.md`).
- [x] Document ADR 006: Snapshot and version history strategy (`docs/decisions/006-snapshots.md`).
- [x] Create implementation checklist tracking document (`docs/implementation-plan.md`).

### Phase 1: Monorepo foundation, configuration, and developer experience

- [x] Root `package.json` with npm workspaces configuration.
- [x] Shared TypeScript configurations (`packages/config/tsconfig.base.json`, etc.).
- [x] Working ESLint configuration and root lint script (four non-blocking warnings remain).
- [x] Shared environment schema & validation with Zod (`packages/contracts/src/env.ts`).
- [x] Root `.env.example` with safe defaults.
- [x] Docker Compose for PostgreSQL 16 and Redis 7 with healthchecks and persistent volumes.
- [x] Centralized logging with request ID tracking and redaction of credentials.
- [x] Standardized API error responses and status code conventions.
- [ ] CI workflow script for install, lint, typecheck, test, and build (workflow exists; meaningful lint and passing pipeline remain unverified).

### Phase 2: Database design, Prisma, and migrations

- [x] Prisma schema with `User`, `Session`, `Workspace`, `WorkspaceMember`, `Page`, `PagePermission`, `DocumentState`, `DocumentUpdate`, `Comment`, `CommentReply`, `DocumentSnapshot`, `Invitation`.
- [x] Unique constraints, foreign keys with `onDelete: Cascade` / `Restrict`, and performance indexes.
- [x] Binary `Bytes` column for raw Yjs state.
- [~] Initial Prisma migration exists; applying it to a live/fresh database is unverified because PostgreSQL is unavailable.
- [~] Development seed script exists (`packages/db/prisma/seed.ts`); safe rerun behavior is not verified against a live database.
- [ ] Database constraint tests (duplicate membership prevention, foreign key integrity) pass against PostgreSQL.
- [x] Documentation of data model in `docs/data-model.md`.

### Phase 3: Authentication, sessions, and account flows

- [x] Argon2 / bcrypt password hashing with salt.
- [x] Zod schemas for register, login, refresh, profile update.
- [x] JWT authentication with access tokens and refresh tokens.
- [x] HTTP-only access/refresh cookies and Bearer token verification; tokens are omitted from JSON auth responses.
- [x] Express auth middleware (`authenticate`, `optionalAuth`) and rate limiting.
- [x] React auth views: Register, Login, Session restoration, Logout.
- [~] Authentication integration tests exist, including access-session revocation assertions; execution is blocked by DB/socket restrictions.

### Phase 4: Workspace and membership management

- [x] Workspace REST endpoints: create, list, detail, update, archive/delete.
- [x] Workspace member endpoints: list members, update role (`OWNER`, `ADMIN`, `MEMBER`), remove member.
- [~] Invitations flow: create and accept for the invited email; live verification remains.
- [~] Last-owner protections exist but need concurrency-safe transaction coverage.
- [x] React UI: workspace switcher, create workspace, member management, invitation creation/acceptance.
- [ ] Integration tests for workspace access boundaries, invitation email binding, and ownership invariants (execution blocked by DB/socket restrictions).

### Phase 5: Page hierarchy, navigation, and permission model

- [~] Page REST endpoints: create, get tree, get detail, rename/archive, move, delete. Restore is not implemented.
- [x] Page hierarchy validation: workspace boundaries, parent existence, cycle detection; moves use serializable transactions.
- [x] Effective permission resolver service (`VIEW`, `COMMENT`, `EDIT`) for reads and page access checks.
- [x] Page permission endpoints: view permissions, update permissions (manager-only).
- [~] React UI: nested tree, create/open, page header and permission badge; move/archive controls and breadcrumbs remain.
- [ ] Permission matrix integration tests covering all roles and levels.

### Phase 6: Rich-text editor and local document model

- [x] Tiptap editor integration with StarterKit formatting, headings, lists, quote, code, and links.
- [x] Editor component architecture separated from shell.
- [x] Formatting toolbar and placeholder.
- [x] Collaborative undo/redo configured without local history extension.
- [ ] Document serialization/import/export (Markdown / JSON).
- [ ] Editor unit and component tests.

### Phase 7: Yjs collaboration and durable document persistence

- [x] Authenticated WebSocket server (`apps/collaboration`).
- [x] Yjs document rooms keyed by `pageId`.
- [x] Token authentication and page permission verification on connection.
- [x] Room state loaded from PostgreSQL `DocumentState` on init.
- [x] Real-time CRDT updates broadcasted to room clients.
- [x] Debounced persistence to PostgreSQL `DocumentState` on change.
- [ ] Reconnect, retry, and connection state indicator in UI (connected, saving, saved, offline).
- [ ] Multi-client convergence tests and persistence recovery tests.

### Phase 8: Presence, avatars, and live cursors

- [x] Yjs awareness protocol integration.
- [x] Distinguishable collaborator colors and usernames.
- [x] Real-time remote cursor positioning and text selection rendering.
- [x] Collaborator presence count in document header.
- [ ] Automatic timeout and disconnect cleanup of stale presence.
- [ ] Awareness update throttling to prevent network flooding.
- [ ] Presence tests.

### Phase 9: Comments and discussion

- [x] Comment REST endpoints: create, list by page, reply, resolve, reopen, delete.
- [x] Authorization: only `COMMENT` or `EDIT` can comment; author or admin can delete.
- [~] Anchored comments support offsets/text in API; editor selection anchoring and resilient mapping await Phase 6.
- [~] React UI: page comment panel, replies, resolve/reopen and delete controls; anchor selection integration remains.
- [ ] Optimistic updates with rollback on error.
- [~] Comment permission/API tests authored; execution awaits PostgreSQL and local socket access.

### Phase 10: Version history, snapshots, and restore

- [ ] Snapshot endpoints: list snapshots, create snapshot, get detail, restore snapshot.
- [ ] Binary CRDT snapshot storage and human-readable preview storage.
- [ ] Non-destructive restore transition: applies forward CRDT update and broadcasts via WebSocket.
- [ ] React UI: Version history drawer, snapshot timeline, preview mode, restore confirmation.
- [ ] Version history integration tests.

### Phase 11: Redis and multi-instance collaboration scaling

- [x] Redis adapter for `apps/collaboration` using Hocuspocus Redis extension and `ioredis`.
- [x] Cross-instance document updates and awareness via adapter.
- [ ] Cross-instance test verifying updates and presence between two distinct collaboration servers.
- [ ] Redis disconnect resilience and reconnect backoff.
- [ ] Horizontal scaling verification report.

### Phase 12: Frontend product polish and complete user journeys

- [ ] Consistent UI design system (Tailwind CSS, Radix UI primitives, Lucide icons).
- [ ] Complete user journeys tested end-to-end.
- [ ] Loading skeletons, empty states, error boundaries, accessible keyboard navigation.
- [ ] Search within accessible pages.

### Phase 13: Security, reliability, and performance hardening

- [ ] Comprehensive security audit (authorization on all endpoints and WebSocket messages).
- [ ] Input validation on all requests using Zod.
- [ ] Rate limiting, CORS, secure HTTP headers (Helmet), size limits.
- [ ] Revoked member disconnection across active WebSocket instances.
- [ ] Graceful shutdown handlers for API and Collaboration servers.
- [ ] Security test suite.

### Phase 14: Automated testing and acceptance suite

- [ ] Unit tests, API integration tests, collaboration convergence tests, E2E tests.
- [ ] Verification of all acceptance criteria.
- [ ] Coverage reports.

### Phase 15: Docker, deployment, demo, and final documentation

- [ ] Multi-stage production Dockerfiles for `web`, `api`, `collaboration`.
- [ ] Unified `docker-compose.yml` for complete full-stack environment.
- [~] README with local setup/test/run instructions (deployment and collaboration steps remain).
- [x] Architecture documentation (`docs/architecture.md`), data model (`docs/data-model.md`), API specs (`docs/api.md`).
- [~] 10-minute presentation outline (`docs/presentation.md`) drafted; update with verified collaboration results later.
- [ ] Verification report and demo instructions.
