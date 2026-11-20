# ADR 006: Snapshot and Version History Strategy

## Status

Accepted

## Context

Users require the ability to view version history, inspect previous snapshots, and restore an earlier state. Because real-time documents operate on CRDTs, simply rolling back database rows or discarding updates breaks state vectors for active clients and causes data corruption or loss.

## Decision

1. **Snapshot Creation**:
   - Snapshots can be created:
     - **Manually**: A user clicks "Create version" and provides an optional label (e.g. "Release notes draft v1").
     - **Milestone/Interval**: Automatic periodic checkpoint when substantial edits occur.
   - When a snapshot is taken:
     - The current canonical `Y.Doc` state is encoded using `Y.encodeStateAsUpdate(doc)`.
     - A readable JSON preview (e.g., ProseMirror document JSON / plain text summary) is also extracted for fast history browsing without loading full CRDT state vectors.
     - Stored in the `DocumentSnapshot` table with `pageId`, `createdBy`, `label`, `state` (binary), `preview` (JSON/text), and `createdAt`.

2. **Snapshot Inspection**:
   - The version history panel lists snapshots sorted by `createdAt DESC`.
   - Users can preview the document content of any past snapshot side-by-side or in read-only preview mode.

3. **Restore Strategy (Non-Destructive Forward Transition)**:
   - Restoring a snapshot must NEVER delete history or reset CRDT state vectors destructively.
   - Instead, restoring snapshot $S$ is executed as a **compensatory forward edit**:
     1. The server loads snapshot $S$'s binary state into a temporary document `Y.Doc`.
     2. In the active canonical `Y.Doc`, a transaction replaces current content with the content from $S$ (or computes diff updates).
     3. This produces a standard CRDT update that transitions the current live document to match the snapshot content.
     4. The resulting update is broadcasted over WebSocket and Redis to all connected clients.
     5. The active editor immediately reflects the restored text for all active users without page reload.
     6. A new snapshot entry is automatically recorded: `label: "Restored from <timestamp / label>"`.
     7. The updated document state is persisted to PostgreSQL.

4. **Permissions**:
   - Viewing snapshots requires at least `VIEW` permission on the page.
   - Creating manual snapshots requires `EDIT` permission.
   - Restoring a snapshot requires `EDIT` permission (or `ADMIN`/`OWNER`).

## Consequences

- No split-brain or divergent CRDT states when restoring versions.
- Complete audit trail and recovery without accidental data loss.
