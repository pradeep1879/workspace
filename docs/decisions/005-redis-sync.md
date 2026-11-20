# ADR 005: Redis Pub/Sub and Multi-Instance Document Synchronization

## Status

Accepted

## Context

In a scaled deployment, multiple collaboration server instances run behind a load balancer. Two users editing the same page simultaneously may connect to different WebSocket server instances. Document edits and cursor presence must cross server instances with minimal latency.

## Decision

1. **Redis Pub/Sub Architecture**:
   - Each collaboration server instance maintains Redis connections for pub/sub (Subscriber client and Publisher client) via `ioredis`.
   - Redis channels are partitioned per page:
     - `collab:page:<pageId>:update`: Broadcasts binary Yjs document updates.
     - `collab:page:<pageId>:awareness`: Broadcasts client awareness (cursors, selections, online status).
     - `collab:page:<pageId>:control`: Broadcasts control signals (e.g. force snapshot restore, kick user).

2. **Cross-Instance Message Flow**:
   - **User A connects to Instance 1, User B connects to Instance 2**:
     - When Instance 1 initializes room `pageId`, it subscribes to `collab:page:<pageId>:*`.
     - When Instance 2 initializes room `pageId`, it subscribes to `collab:page:<pageId>:*`.
   - **Update Flow**:
     1. User A sends CRDT update $U$ to Instance 1.
     2. Instance 1 applies $U$ to its local `Y.Doc`.
     3. Instance 1 broadcasts $U$ to other clients connected to Instance 1 in that room (with an origin identifier to prevent echo loops).
     4. Instance 1 publishes $U$ to Redis `collab:page:<pageId>:update` along with `instanceId` metadata.
     5. Instance 2 receives the Redis message. Seeing `instanceId != Instance 2`, it applies $U$ to its local `Y.Doc` and broadcasts it to User B.
   - **Awareness Flow**:
     - Client presence updates are serialized and published over Redis similarly, allowing cursors and live avatars to reflect across all instances.

3. **Persistence Coordination**:
   - To avoid redundant simultaneous database writes when multiple instances host clients for the same document, debounced persistence uses a distributed lock or deterministic coordinator election via Redis keys:
     - Key: `collab:lock:persist:<pageId>` with a TTL (e.g., 5 seconds).
     - Only the lock holder flushes the compacted state to PostgreSQL; if the lock expires or the holding instance dies, another instance acquires the lock and persists.

4. **Resilience & Graceful Degradation**:
   - If Redis connection drops, the collaboration servers log the error, attempt exponential backoff reconnection, and fall back to local-only room broadcasting without crashing active WebSocket connections.
   - PostgreSQL remains the authoritative, persistent source of truth. Redis holds no permanent state.

## Consequences

- True horizontal scaling: adding more collaboration server instances increases capacity linearly.
- Low latency synchronization across server boundaries.
