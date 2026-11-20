# Real-Time Collaborative Workspace --- End-to-End Implementation Plan

> **Project:** Real-Time Collaborative Workspace (Notion/Figma style)\
> **Goal:** Build a production-minded collaborative workspace where
> multiple users can edit the same document at the same time, see live
> presence/cursors, comment, review version history, and collaborate
> under workspace/page permissions.\
> **Execution rule:** Work through every phase in order without asking
> the user for another prompt. After each phase, run its verification
> checklist. Fix failures before proceeding. Do not mark a phase
> complete merely because code was written.

------------------------------------------------------------------------

## 1. Product scope and success criteria

### Core user experience

1.  A user can sign up, log in, and manage their account.
2.  A user can create a workspace and invite or add other members.
3.  Members can create, rename, move, and open pages inside a workspace.
4.  A page contains a rich-text editor powered by **Tiptap/ProseMirror**
    and synchronized with **Yjs**.
5.  Multiple users can edit one page concurrently. Changes synchronize
    live and converge without losing edits.
6.  Users can see who is online and see other users' cursors/selections
    with distinct identities.
7.  Users can add comments to a page and, where feasible, anchor
    comments to selected text.
8.  The system stores version-history snapshots and allows users to
    inspect and restore a previous version.
9.  Permissions support at least **view**, **comment**, and **edit**.
10. The collaboration service can scale across multiple instances using
    **Redis** for cross-instance coordination/pub-sub.
11. The project has automated tests, Docker-based local setup, useful
    documentation, an architecture diagram, and a demonstrable deployed
    or recorded demo.

### Required technology from the assignment

-   Frontend: React, TypeScript
-   Backend: Node.js, Express
-   Database: PostgreSQL
-   ORM: Prisma
-   Validation: Zod
-   Real-time collaboration: Yjs, Tiptap/ProseMirror, WebSocket
    (`y-websocket` or a compatible authenticated WebSocket server)
-   Scaling: Redis
-   Local/deployment environment: Docker

### Sensible implementation choices

Use a TypeScript monorepo so the frontend, API, and collaboration server
can share validated types and utilities.

Suggested structure:

``` text
collaborative-workspace/
├── apps/
│   ├── web/                  # React application
│   ├── api/                  # Express REST API
│   └── collaboration/        # Authenticated Yjs WebSocket server
├── packages/
│   ├── db/                   # Prisma schema, migrations, client
│   ├── contracts/            # Shared Zod schemas and API types
│   ├── config/               # Shared TypeScript/lint/tooling config
│   └── ui/                   # Shared UI primitives (optional)
├── infra/
│   ├── docker/
│   └── diagrams/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── data-model.md
│   └── decisions/
├── scripts/
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

Use the package manager already present in the repository. If starting
from an empty repository, choose one package manager and keep it
consistent. Do not introduce a monorepo migration halfway through
implementation.

------------------------------------------------------------------------

## 2. Non-negotiable execution instructions for the coding agent

The implementation agent must follow these rules for the entire plan:

1.  **Autonomous execution:** Start at Phase 0 and continue through the
    final phase. Do not stop to ask the user to provide the next prompt
    or approve routine technical choices.
2.  **Phase gates:** A phase is complete only when its acceptance
    criteria and verification commands pass. If a check fails, diagnose
    and fix it before moving on.
3.  **Inspect before changing:** First inspect the existing repository,
    package manager, scripts, conventions, and current implementation.
    Preserve working code where possible.
4.  **No fake completion:** Do not add placeholder buttons, mocked
    success responses, TODO-only implementations, or hard-coded demo
    data in place of required functionality.
5.  **End-to-end integration:** Connect each feature to the real API,
    database, and authorization layer. UI-only implementations do not
    count.
6.  **Security by default:** Enforce authorization on the server for
    every protected REST and WebSocket operation. Never trust a
    workspace ID, page ID, role, or user ID supplied by the client.
7.  **Data integrity:** Use database transactions for multi-record
    operations. Persist collaborative document state safely and handle
    reconnects.
8.  **No silent data loss:** Handle WebSocket disconnects,
    reconnections, stale clients, concurrent edits, and persistence
    failures. Show clear UI feedback when the connection is offline or
    saving is delayed.
9.  **Accessible and complete UI:** Include loading, empty, error,
    success, disabled, and permission-denied states. Support keyboard
    navigation and responsive layouts.
10. **Maintainable code:** Use feature-based modules, clear names, typed
    API contracts, centralized error handling, and consistent
    validation. Avoid giant components and duplicated business logic.
11. **Tests are part of implementation:** Add tests with each phase, not
    at the end only.
12. **Keep documentation current:** Update setup instructions,
    environment variables, architecture, API docs, and known limitations
    as implementation evolves.
13. **Run checks after meaningful changes:** Typecheck, lint, tests, and
    build the affected apps. Run the full suite at phase gates.
14. **Do not weaken tests or security to make checks pass.** Fix the
    implementation.
15. **Final report:** At the end, provide a phase-by-phase completion
    summary, commands run, test results, deployment/demo details, and
    any genuinely unresolved limitations.

------------------------------------------------------------------------

## 3. Phase-by-phase implementation

## Phase 0 --- Repository discovery and implementation blueprint

### Tasks

-   Inspect the complete repository before editing.
-   Identify existing apps, package manager, framework versions,
    scripts, environment files, database setup, and deployment
    configuration.
-   Identify reusable code and any incomplete features.
-   Decide whether the repository is already a monorepo. Preserve its
    existing architecture if sound; otherwise establish the structure
    described above.
-   Write short architecture decisions for:
    -   REST API vs collaboration WebSocket responsibilities.
    -   Yjs document persistence format and update strategy.
    -   Authentication shared between REST and WebSocket.
    -   Permission inheritance and role precedence.
    -   Redis pub/sub and multi-instance document synchronization.
    -   Snapshot/version-history strategy.
-   Create or update `docs/implementation-plan.md` with the execution
    checklist and mark this plan as the source of truth.

### Verification gate

-   Repository structure and existing conventions are documented.
-   No existing working functionality has been unnecessarily removed.
-   Architecture decisions are recorded before building dependent
    modules.
-   A clean baseline typecheck/build is run where the repository
    currently supports it.

**Do not proceed** until the repository assessment and architecture
decisions are complete.

------------------------------------------------------------------------

## Phase 1 --- Monorepo foundation, configuration, and developer experience

### Tasks

-   Establish or normalize the workspace structure.
-   Configure TypeScript consistently across apps and packages.
-   Add linting, formatting, path aliases, and shared scripts.
-   Add environment-variable validation using Zod. Fail fast with clear
    messages for missing or malformed configuration.
-   Add `.env.example` with variable names and safe example values only.
-   Configure Docker Compose for PostgreSQL and Redis.
-   Add health checks and persistent volumes for local infrastructure.
-   Configure application logging with request IDs and useful error
    context. Never log passwords, tokens, session cookies, or document
    contents.
-   Add shared API response/error conventions.
-   Add CI workflow for install, lint, typecheck, test, and build.

### Verification gate

-   A new developer can start PostgreSQL and Redis using the documented
    command.
-   All apps load validated environment configuration.
-   Lint, typecheck, tests, and builds run from the repository root.
-   CI runs the same checks and fails on errors.

------------------------------------------------------------------------

## Phase 2 --- Database design, Prisma, and migrations

### Tasks

Design and implement the relational model. Names can be adjusted to
match existing conventions, but relationships and constraints must be
preserved.

Minimum entities:

-   `User`: identity, email, password hash (if using password auth),
    display name, avatar, timestamps.
-   `Session` or equivalent: refresh/session lifecycle, expiry,
    revocation.
-   `Workspace`: name, owner, timestamps.
-   `WorkspaceMember`: workspace, user, role, joined timestamp; unique
    workspace/user pair.
-   `Page`: workspace, parent page (optional), title, creator,
    ordering/position, timestamps, archived/deleted state.
-   `PagePermission` (if permissions are page-specific): page, user or
    group, permission level.
-   `DocumentState`: page ID, Yjs state/update data, state version,
    updated timestamp.
-   `DocumentUpdate` (if using an append-only update log): page ID,
    update bytes, actor, timestamp, sequence.
-   `Comment`: page, author, body, optional anchor/selection metadata,
    resolved state, timestamps.
-   `CommentReply` (optional if replies are separate): comment, author,
    body, timestamp.
-   `DocumentSnapshot`: page, creator, label, serialized document
    state/content, created timestamp.
-   `Invitation` (if implementing email-style invitations): workspace,
    invited email, role, token hash, expiry, accepted timestamp.

### Data-model requirements

-   Use foreign keys and appropriate `onDelete` behavior.
-   Add unique constraints for memberships and other natural uniqueness
    rules.
-   Add indexes for common lookups: workspace membership, pages by
    workspace/parent, comments by page, snapshots by page/time, and
    updates by page/sequence.
-   Store Yjs binary data using a binary-safe database type. Do not
    convert arbitrary update bytes to lossy text.
-   Store password hashes only, never plaintext passwords.
-   Avoid storing redundant role or ownership data unless its
    consistency is enforced.
-   Use Prisma migrations; do not rely on `prisma db push` as the
    production migration strategy.
-   Seed only predictable development fixtures and never seed production
    credentials.

### Verification gate

-   Migrations apply to a fresh database.
-   Prisma client generation succeeds.
-   Seed script works and is safe to rerun.
-   Database constraints are tested, including duplicate membership
    prevention and valid foreign-key behavior.
-   Document the schema and important indexes in `docs/data-model.md`.

------------------------------------------------------------------------

## Phase 3 --- Authentication, sessions, and account flows

### Tasks

-   Implement registration, login, logout, current-user, and session
    refresh/revocation flows.
-   Hash passwords with a modern password-hashing algorithm if password
    authentication is used.
-   Validate request bodies, params, and query strings with shared Zod
    schemas.
-   Implement centralized authentication middleware and centralized
    error handling.
-   Use secure, HTTP-only cookies for refresh/session credentials where
    appropriate; configure `Secure`, `SameSite`, domain, and CORS
    correctly for the deployment topology.
-   Protect against brute-force login attempts with rate limiting.
-   Add password reset only if the project scope and email configuration
    support it; otherwise document it as a non-core limitation rather
    than creating a fake flow.
-   Add frontend auth screens, session restoration, logout, protected
    routes, and form validation.
-   Ensure unauthorized API requests return consistent status codes and
    error shapes.

### Verification gate

-   Registration, login, logout, and session restoration work end to
    end.
-   Invalid credentials and malformed inputs are handled safely.
-   Expired/revoked sessions cannot access protected routes.
-   Passwords and tokens are not exposed in API responses or logs.
-   Authentication integration tests pass.

------------------------------------------------------------------------

## Phase 4 --- Workspace and membership management

### Tasks

-   Implement workspace create, list, detail, rename, and archive/delete
    operations as appropriate.
-   Implement member listing and member role changes.
-   Implement invitations or a clearly defined member-add flow.
-   Define workspace roles, for example:
    -   `OWNER`: full control, including workspace deletion and
        ownership transfer.
    -   `ADMIN`: manage members and workspace settings.
    -   `MEMBER`: create and collaborate on pages subject to page
        permissions.
-   Enforce membership and role checks in service-layer functions, not
    only in controllers or UI.
-   Prevent removing/demoting the final owner.
-   Build workspace switcher, create-workspace dialog, settings, member
    list, and invite/member management UI.
-   Add empty states for users with no workspaces.

### Verification gate

-   Users can only list and access workspaces they belong to.
-   Non-authorized members cannot manage workspace settings or
    membership.
-   Ownership invariants are enforced under concurrent requests.
-   Workspace flows work in the UI and integration tests.

------------------------------------------------------------------------

## Phase 5 --- Page hierarchy, navigation, and permission model

### Tasks

-   Implement page create, read, rename, move/reorder, archive, restore,
    and delete operations.
-   Support nested pages with validated parent/workspace relationships.
-   Prevent moving a page beneath itself or one of its descendants.
-   Define effective page access:
    -   Workspace membership is required.
    -   Page-level access can grant `VIEW`, `COMMENT`, or `EDIT`.
    -   Workspace owner/admin privileges must have clearly documented
        precedence.
    -   `VIEW` cannot edit or comment; `COMMENT` can read and comment
        but cannot modify document content; `EDIT` can edit and comment.
-   Apply permission checks to page metadata, document APIs, comments,
    snapshots, and WebSocket connections.
-   Avoid leaking page titles or content to non-members.
-   Build the app shell: sidebar, workspace navigation, nested page
    tree, breadcrumbs, page header, and responsive navigation.
-   Add page loading, empty, not-found, archived, and access-denied
    states.

### Verification gate

-   Page hierarchy operations preserve workspace boundaries.
-   Cycles and invalid moves are rejected.
-   Every page operation checks effective permissions.
-   Permission matrix tests cover view/comment/edit and workspace
    owner/admin behavior.
-   Navigation remains usable with deep page nesting and on smaller
    screens.

------------------------------------------------------------------------

## Phase 6 --- Rich-text editor and local document model

### Tasks

-   Integrate Tiptap/ProseMirror with a deliberate extension set:
    -   paragraphs and headings
    -   bold, italic, underline, strike
    -   bullet and ordered lists
    -   blockquote and code block
    -   links
    -   images only if upload/storage is implemented safely
    -   tables only if supported end to end
-   Create a clean editor component boundary; keep editor state out of
    unrelated page-shell components.
-   Implement slash-command or toolbar interactions only where fully
    functional.
-   Add keyboard shortcuts, selection behavior, placeholder text, and
    accessible labels.
-   Configure Yjs integration using the supported Tiptap collaboration
    extensions.
-   Do not enable a competing editor history mechanism that conflicts
    with Yjs undo/redo; configure collaboration-aware undo behavior.
-   Implement document serialization/import/export for supported
    content.
-   Ensure editor content is not silently overwritten when switching
    pages or reconnecting.

### Verification gate

-   Rich-text formatting persists through reload.
-   Editor can open and render existing documents.
-   Keyboard navigation and basic editing work.
-   Unsupported formatting is not silently discarded.
-   Editor unit/component tests pass.

------------------------------------------------------------------------

## Phase 7 --- Yjs collaboration and durable document persistence

### Tasks

-   Implement the collaboration server using an authenticated WebSocket
    endpoint and Yjs document rooms keyed by page ID.
-   Authenticate the connection and authorize page access before joining
    a room.
-   Enforce permission levels at connection and update time. View-only
    users must not publish document updates.
-   Integrate Tiptap with Yjs so editor transactions become CRDT
    updates.
-   Persist document state safely:
    -   Load the persisted Yjs state when a room is initialized.
    -   Apply incoming updates to the in-memory Y.Doc.
    -   Persist updates or periodically persist a compacted state.
    -   Make persistence idempotent and resilient to retries.
    -   Avoid acknowledging a change as durably saved before the
        persistence policy allows it.
-   Handle document room lifecycle, idle cleanup, reconnect, duplicate
    messages, and server shutdown.
-   Define a recovery path if the collaboration server restarts while
    users are connected.
-   Add save/connection status in the editor: connecting, connected,
    saving, saved, offline, reconnecting, and error.
-   Ensure multiple tabs for the same user do not corrupt or overwrite
    one another.

### Verification gate

-   Two independent browser sessions editing the same page converge to
    the same content.
-   Concurrent insertions/deletions do not lose updates.
-   A collaboration server restart does not lose acknowledged persisted
    changes.
-   Unauthorized users cannot join a room or submit updates.
-   Reconnect and offline/recovery tests pass.
-   Persistence load/save behavior is tested against a real test
    database.

------------------------------------------------------------------------

## Phase 8 --- Presence, avatars, and live cursors

### Tasks

-   Implement awareness/presence using Yjs awareness or the
    collaboration protocol's supported equivalent.
-   Publish user identity, avatar, display color, and cursor/selection
    state without exposing private account data.
-   Assign stable, visually distinguishable colors for active
    collaborators in a document session.
-   Show active collaborator avatars and online count.
-   Render remote cursors and selections in the editor.
-   Remove stale presence on disconnect and handle abrupt tab/browser
    termination using awareness timeouts.
-   Avoid treating presence as durable user data.
-   Add sensible limits and throttling for high-frequency awareness
    updates.

### Verification gate

-   Multiple users see each other's presence and cursor positions.
-   Cursor identity is distinguishable and correctly labeled.
-   Presence disappears after disconnect/timeout.
-   Presence updates do not create excessive database writes.
-   Test with several tabs and browser sessions.

------------------------------------------------------------------------

## Phase 9 --- Comments and discussion

### Tasks

-   Implement create, list, reply (if supported), resolve/reopen, and
    delete comment operations.
-   Enforce `COMMENT` or `EDIT` permission for creating comments and
    appropriate author/admin rules for deletion.
-   Support page-level comments first. Add text-anchored comments only
    if anchors can survive edits reasonably; use stable editor-relative
    positions rather than fragile character offsets.
-   Show comment author, timestamp, body, resolved state, and replies if
    implemented.
-   Add optimistic UI only with rollback/error handling.
-   Handle deleted or changed anchors gracefully.
-   Add pagination or incremental loading for pages with many comments.

### Verification gate

-   View-only users cannot comment.
-   Commenters can comment but cannot edit page content.
-   Unauthorized users cannot read comments on inaccessible pages.
-   Resolve/reopen and reply flows work end to end.
-   Comment tests cover permissions and invalid anchors.

------------------------------------------------------------------------

## Phase 10 --- Version history, snapshots, and restore

### Tasks

-   Define when snapshots are created: manual snapshot, periodic
    checkpoint, or meaningful milestone. Avoid creating a snapshot for
    every keystroke.
-   Create snapshots from a consistent Yjs document state.
-   Store snapshot creator, timestamp, optional label, and restorable
    document data.
-   Build version-history UI with timestamps, authors, and preview/diff
    where feasible.
-   Implement restore as a new document state transition or new
    snapshot, not destructive deletion of history.
-   Ensure restore is permission-protected and does not overwrite active
    users' edits without synchronization.
-   Coordinate restore with the live Yjs room: update the canonical
    document and broadcast the resulting state to connected clients.
-   Document snapshot retention/cleanup policy.

### Verification gate

-   A user can create and view snapshots.
-   Restoring a snapshot returns the document to that version while
    preserving history.
-   Connected clients receive the restored state.
-   Concurrent edits during restore are handled deterministically.
-   Snapshot access and restore permissions are tested.

------------------------------------------------------------------------

## Phase 11 --- Redis and multi-instance collaboration scaling

### Tasks

-   Introduce Redis for cross-instance pub/sub or the collaboration
    provider's supported horizontal-scaling adapter.
-   Ensure users connected to different collaboration server instances
    receive the same document updates and awareness changes.
-   Keep PostgreSQL as durable persistence; Redis must not become the
    only copy of document data.
-   Define room ownership, update propagation, reconnect behavior, and
    failure handling.
-   Add Redis connection retry/backoff, health checks, and graceful
    degradation behavior.
-   Ensure duplicate delivery is safe and updates remain idempotent.
-   Add structured metrics/logging for active rooms, connections, update
    rates, persistence latency, Redis errors, and reconnects.
-   Do not claim horizontal scaling merely because Redis is installed;
    prove it with multiple server instances.

### Verification gate

-   Start at least two collaboration server instances against the same
    PostgreSQL and Redis.
-   Connect separate browsers to different instances and verify live
    edits and presence synchronize.
-   Stop one instance and verify clients reconnect to a healthy instance
    without losing persisted data.
-   Redis outage behavior is explicit and tested.
-   Record the test setup and results.

------------------------------------------------------------------------

## Phase 12 --- Frontend product polish and complete user journeys

### Tasks

Complete the experience across all implemented features:

-   Authentication and account menu.
-   Workspace switcher and workspace creation.
-   Member/invitation management.
-   Nested page sidebar and page actions.
-   Rich-text editor and formatting controls.
-   Live collaborators, cursors, and connection status.
-   Comments and discussion panel.
-   Version history and restore flow.
-   Permission-aware controls and clear access-denied messages.
-   Search pages within accessible workspaces if time allows; search
    must respect permissions.
-   Toasts, confirmations, dialogs, keyboard shortcuts, and error
    recovery.
-   Responsive layouts for desktop, tablet, and mobile.
-   Skeletons for loading, meaningful empty states, and retry actions.
-   Avoid decorative controls that do not work.

### Design quality requirements

-   Use a consistent spacing, typography, color, border, and radius
    system.
-   Prefer a focused workspace interface over a generic dashboard full
    of cards.
-   Keep the editor as the primary content area.
-   Keep navigation and collaboration controls discoverable but
    unobtrusive.
-   Ensure focus states, contrast, labels, and keyboard operation.
-   Avoid layout shifts when collaborators join or comments load.

### Verification gate

Run complete user journeys:

1.  New user registers and creates a workspace.
2.  User creates a page and writes formatted content.
3.  User opens the same page in a second browser and edits concurrently.
4.  Both users see live changes, presence, and cursors.
5.  A commenter adds a comment; a viewer cannot.
6.  An editor creates a snapshot and restores it.
7.  A view-only user can read but cannot edit.
8.  A removed member loses access, including an already-open WebSocket
    session.

------------------------------------------------------------------------

## Phase 13 --- Security, reliability, and performance hardening

### Tasks

-   Audit every REST route and WebSocket message for authentication and
    authorization.
-   Validate all external input with Zod or equivalent runtime
    validation.
-   Add rate limits to authentication, invitations, comments, and
    connection establishment.
-   Configure CORS and WebSocket origin checks explicitly.
-   Protect against cross-site request forgery where cookie-based
    authentication requires it.
-   Set request/body/message size limits.
-   Prevent mass assignment and unsafe object updates.
-   Sanitize rendered user-generated content and validate link
    protocols.
-   Ensure secrets are never committed and production config is not
    permissive.
-   Add database transaction boundaries for multi-step membership,
    invitation, snapshot, and restore operations.
-   Add graceful shutdown for API and collaboration servers.
-   Add pagination and query limits.
-   Profile slow queries and add indexes based on evidence.
-   Add load/stress tests for concurrent editing and reconnect storms.
-   Add observability for API errors, WebSocket connections, update
    persistence, and Redis health.

### Verification gate

-   Security tests verify cross-workspace and cross-page access is
    denied.
-   A revoked member cannot continue editing through an existing socket.
-   Oversized payloads and invalid messages are rejected safely.
-   Load test results are recorded with setup, concurrent clients,
    duration, and observed limits.
-   No known critical secrets or authorization bypasses remain.

------------------------------------------------------------------------

## Phase 14 --- Automated testing and acceptance suite

Testing should already exist in earlier phases. This phase closes gaps
and runs the complete acceptance suite.

### Required test layers

-   **Unit tests:** permission resolution, validation, page-tree rules,
    snapshot logic, collaboration persistence helpers.
-   **API integration tests:** authentication, workspaces, memberships,
    pages, comments, snapshots, permissions.
-   **Database tests:** constraints, migrations, transactions, and
    persistence.
-   **Collaboration tests:** Yjs convergence, concurrent updates,
    reconnect, persistence recovery, multi-instance propagation.
-   **Frontend tests:** critical forms, page navigation, editor states,
    permission-aware controls, comments, version history.
-   **End-to-end tests:** complete user journeys using multiple browser
    contexts.
-   **Load tests:** several simultaneous editors and multiple
    collaboration server instances.

### Acceptance scenarios

-   Two or more editors can make overlapping edits and converge.
-   A user with `VIEW` cannot modify content through either REST or
    WebSocket.
-   A user with `COMMENT` can comment but cannot edit document content.
-   A user outside the workspace cannot discover or access its pages.
-   Removing a member revokes access for subsequent API calls and active
    collaboration connections.
-   A server restart recovers the last durably persisted document.
-   Redis-backed multi-instance synchronization works.
-   Snapshot restore updates connected clients and preserves history.
-   The app handles API, database, Redis, and WebSocket failures with
    clear feedback.

### Verification gate

-   All required tests pass from a clean environment.
-   Flaky tests are investigated rather than skipped.
-   Coverage is reported for critical permission and collaboration
    logic.
-   Known gaps are explicitly documented.

------------------------------------------------------------------------

## Phase 15 --- Docker, deployment, demo, and final documentation

### Tasks

-   Create production-ready Dockerfiles for web (if self-hosted), API,
    and collaboration server.
-   Use multi-stage builds, non-root runtime users, minimal images, and
    health checks.
-   Configure production PostgreSQL and Redis connections.
-   Run migrations as a controlled deployment step.
-   Configure HTTPS, secure cookies, CORS, and WebSocket proxying.
-   Configure sticky sessions only if required by the selected
    collaboration architecture; do not use them as a substitute for
    cross-instance synchronization.
-   Add deployment instructions for the chosen host.
-   Deploy the application if credentials/infrastructure are available.
    If not, produce a reproducible local demo and a screen recording.
-   Create demo accounts and seed content only in a safe demo
    environment.
-   Prepare architecture and data-flow diagrams.
-   Complete API documentation and environment-variable documentation.
-   Write a clear README with prerequisites, setup, migrations, seed,
    test, build, and deployment commands.
-   Prepare a 10-minute presentation covering problem, design,
    architecture, CRDT conflict handling, scaling, challenges, test
    results, and next steps.
-   Write an individual contribution/learning reflection template for
    each intern.

### Verification gate

-   A clean machine can follow the README and run the project.
-   Docker Compose starts all required services with health checks.
-   Production build succeeds.
-   Deployment health checks pass, including WebSocket connectivity.
-   Demo flows work with at least two independent browser sessions.
-   Architecture diagram, API/data documentation, test results, and
    presentation are ready.

------------------------------------------------------------------------

## 4. Suggested API surface

Adapt route names to the existing codebase, but maintain equivalent
capabilities and consistent REST conventions.

### Authentication

-   `POST /api/auth/register`
-   `POST /api/auth/login`
-   `POST /api/auth/logout`
-   `POST /api/auth/refresh` (if using refresh tokens)
-   `GET /api/auth/me`

### Workspaces and members

-   `POST /api/workspaces`
-   `GET /api/workspaces`
-   `GET /api/workspaces/:workspaceId`
-   `PATCH /api/workspaces/:workspaceId`
-   `DELETE /api/workspaces/:workspaceId` (or archive)
-   `GET /api/workspaces/:workspaceId/members`
-   `POST /api/workspaces/:workspaceId/invitations`
-   `PATCH /api/workspaces/:workspaceId/members/:memberId`
-   `DELETE /api/workspaces/:workspaceId/members/:memberId`

### Pages and permissions

-   `POST /api/workspaces/:workspaceId/pages`
-   `GET /api/workspaces/:workspaceId/pages`
-   `GET /api/pages/:pageId`
-   `PATCH /api/pages/:pageId`
-   `POST /api/pages/:pageId/move`
-   `DELETE /api/pages/:pageId`
-   `GET /api/pages/:pageId/permissions`
-   `PUT /api/pages/:pageId/permissions`

### Comments

-   `GET /api/pages/:pageId/comments`
-   `POST /api/pages/:pageId/comments`
-   `POST /api/comments/:commentId/replies` (if replies are supported)
-   `PATCH /api/comments/:commentId`
-   `POST /api/comments/:commentId/resolve`
-   `DELETE /api/comments/:commentId`

### Version history

-   `GET /api/pages/:pageId/snapshots`
-   `POST /api/pages/:pageId/snapshots`
-   `GET /api/snapshots/:snapshotId`
-   `POST /api/snapshots/:snapshotId/restore`

### Collaboration

-   Authenticated WebSocket endpoint, for example:
    -   `wss://<host>/collaboration? pageId=<pageId>` (use a properly
        encoded query parameter in implementation)
-   The server must authenticate the session, authorize page access, and
    enforce edit permission before accepting document updates.
-   Do not expose an unauthenticated room-join endpoint.

The exact Yjs wire protocol and message format should follow the chosen
Yjs provider/server implementation rather than inventing an incompatible
custom protocol.

------------------------------------------------------------------------

## 5. Definition of done

The project is complete only when all applicable items below are true:

-   [ ] User authentication and session handling work.
-   [ ] Workspaces and membership management work.
-   [ ] Nested pages and navigation work.
-   [ ] Rich-text editor works and persists content.
-   [ ] Yjs concurrent editing works across independent browsers.
-   [ ] Remote cursors and presence work.
-   [ ] Comments work with permission enforcement.
-   [ ] Version snapshots can be viewed and restored safely.
-   [ ] View/comment/edit permissions are enforced in REST and WebSocket
    paths.
-   [ ] Redis multi-instance synchronization is demonstrated with at
    least two collaboration servers.
-   [ ] Revoked access is removed from active collaboration sessions.
-   [ ] Automated tests cover critical flows and pass.
-   [ ] Docker setup and deployment/demo work.
-   [ ] README, architecture diagram, API/data docs, test results, and
    10-minute presentation are complete.

## 6. Final execution report format

At the end, report:

1.  **Completed phases:** phase number, summary, and evidence.
2.  **Architecture:** apps/services, database, Yjs persistence approach,
    Redis scaling approach.
3.  **Verification:** exact commands run and pass/fail results.
4.  **Collaboration proof:** number of browser clients and server
    instances used in the test.
5.  **Security proof:** permission and revoked-session tests performed.
6.  **Demo/deployment:** URL if actually deployed, otherwise local demo
    and recording location.
7.  **Documentation:** links/paths to README, diagrams, API docs, and
    presentation.
8.  **Remaining limitations:** only real unresolved issues; do not hide
    or misrepresent them.

------------------------------------------------------------------------

## 7. Important technical notes

-   **Yjs is the source of truth for concurrent editing.** Do not
    implement collaboration by repeatedly replacing the entire editor
    HTML or sending the full document on every keystroke.
-   **CRDT convergence is not the same as persistence.** Yjs can merge
    concurrent updates, but the application must still durably store
    updates/state and recover them after process restarts.
-   **Redis is not a database replacement.** Use it to distribute
    collaboration events across instances; persist canonical document
    state in PostgreSQL or another explicitly selected durable store.
-   **Authorization must apply to the socket.** Hiding an edit button is
    not access control. Check permissions before joining and while
    processing updates, and disconnect/restrict sessions when membership
    is revoked.
-   **Presence is ephemeral.** Store online state in the collaboration
    layer, not as permanent user status in PostgreSQL.
-   **Snapshot restore is a collaborative operation.** Coordinate it
    with the active Yjs document and broadcast the resulting update; do
    not only overwrite a database row behind connected clients.
-   **Test with separate browser contexts.** Two tabs can be useful, but
    separate browser profiles or Playwright contexts provide stronger
    proof of independent sessions.
-   **Do not claim scale without a multi-instance test.** A single
    WebSocket server plus Redis running locally does not prove
    horizontal collaboration scaling.

**Execution instruction:** Begin with Phase 0 now. Continue phase by
phase through Phase 15 automatically, verifying each phase and fixing
issues before moving forward. Do not wait for another user prompt
between phases.
