# ADR 001: REST API vs Collaboration WebSocket Responsibilities

## Status

Accepted

## Context

A real-time collaborative workspace requires standard transactional management (CRUD for accounts, workspaces, pages, comments, snapshots) as well as continuous, low-latency, bidirectional real-time data streaming (Yjs CRDT updates, cursor positions, online presence).

## Decision

We split operational responsibilities cleanly between the REST API service (`apps/api`) and the Collaboration WebSocket service (`apps/collaboration`):

1. **REST API (`apps/api`)**:
   - Authentication & session lifecycle (`/api/auth/*`): registration, login, logout, refresh, user profile.
   - Workspaces and membership management (`/api/workspaces/*`): workspace creation, settings, member roles, invitations.
   - Page hierarchy and metadata (`/api/pages/*`): tree navigation, create, rename, reorder/move, archive, delete, and permission assignment.
   - Comments and discussions (`/api/pages/:pageId/comments/*`): create, reply, resolve, reopen, delete.
   - Version history and snapshots (`/api/pages/:pageId/snapshots/*`): list snapshots, create manual snapshots, trigger restore.
   - Health and operational monitoring endpoints.

2. **Collaboration Service (`apps/collaboration`)**:
   - Real-time Yjs CRDT synchronization for active document rooms (`ws://host/collaboration?pageId=...&token=...`).
   - Real-time ephemeral presence and awareness (live cursors, selections, active user avatars).
   - Document room lifecycle management: loading canonical state from PostgreSQL upon room initialization, applying incoming CRDT updates to the in-memory `Y.Doc`, broadcasting to connected clients.
   - Debounced persistence of compacted `Y.Doc` state back to PostgreSQL.
   - Cross-instance sync using Redis Pub/Sub so users connected to different server instances collaborate seamlessly.
   - Real-time notification of document restore events.

## Consequences

- Clean separation of concerns: REST API focuses on relational queries and business logic; Collaboration service focuses on WebSocket statefulness and CRDT convergence.
- Independent scaling: Collaboration servers can scale horizontally based on active WebSocket connections and document rooms without burdening the REST API.
