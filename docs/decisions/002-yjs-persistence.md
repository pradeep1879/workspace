# ADR 002: Yjs Document Persistence Format and Update Strategy

## Status

Accepted

## Context

Yjs documents represent state through binary CRDT updates (`Uint8Array`). Naive strategies such as saving JSON or HTML on every keystroke destroy concurrent editing guarantees, cause race conditions, and cause data loss during concurrent edits. We need a persistence strategy that guarantees CRDT integrity, high performance, and crash resilience.

## Decision

1. **Binary Storage Format**:
   - PostgreSQL `bytea` column in Prisma (`Bytes`) for `DocumentState.state`.
   - Stored using canonical Yjs binary serialization: `Y.encodeStateAsUpdate(doc)`.
   - Update logs or snapshots also use binary `bytea` columns or base64 serialization where necessary to avoid any lossy text encoding.

2. **Room Loading and Initialization**:
   - When the first client connects to a room (`pageId`), the collaboration server instantiates an in-memory `Y.Doc`.
   - The server queries `DocumentState` for `pageId`. If found, `Y.applyUpdate(doc, documentState.state)` initializes the document.
   - If no record exists, a fresh `Y.Doc` is created and an initial record is prepared.

3. **In-Memory & Debounced Persistence Strategy**:
   - Incoming updates from authenticated clients with `EDIT` permission are immediately applied to the in-memory `Y.Doc` and broadcast to room peers and Redis.
   - A debounced persistence timer (e.g., 1000ms idle or maximum 5000ms delay) triggers database persistence.
   - Compaction: The server encodes the full document state using `Y.encodeStateAsUpdate(doc)` and updates the `DocumentState` row in PostgreSQL within a transaction, incrementing `version` and updating `updatedAt`.
   - Flush on Shutdown / Room Eviction: When the last client disconnects from a room or the server receives a SIGTERM/SIGINT signal, any pending debounced writes are immediately flushed to PostgreSQL before the room is destroyed.

4. **Safety Guarantees**:
   - Updates are idempotent due to Yjs CRDT design: applying the same update multiple times produces the identical state.
   - Database writes never overwrite valid document states with empty or corrupt buffers.

## Consequences

- Guaranteed convergence: edits never lost even during simultaneous typing.
- Minimal database load: typing at 60 keystrokes/sec does not trigger 60 database write transactions; it triggers debounced batch writes.
- Instant crash recovery: latest compacted state restored upon restart.
