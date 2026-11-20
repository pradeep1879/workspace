# ADR 003: Authentication Shared Between REST and WebSocket

## Status

Accepted

## Context

Both the REST API and the Collaboration WebSocket server must authenticate incoming requests and identify the acting user securely. The WebSocket protocol initiates via an HTTP upgrade request, where standard headers, cookies, or query parameters can be passed.

## Decision

1. **Token Standard & Session Strategy**:
   - Authentication uses JSON Web Tokens (JWT) signed with a shared secret (`JWT_SECRET`) with configurable expiry (e.g. 15m to 2h access tokens, with refresh tokens stored in database or HTTP-only cookies).
   - The token payload carries the subject: `{ userId: string, email: string, name: string }`.

2. **REST API Authorization**:
   - Clients send `Authorization: Bearer <token>` in the HTTP headers or via secure HTTP-only cookies.
   - Centralized Express middleware verifies the token, queries the active session / user in PostgreSQL, and attaches `req.user` to the request object.

3. **Collaboration WebSocket Authorization**:
   - WebSocket connection URL includes token: `wss://<host>/collaboration?pageId=<pageId>&token=<token>`.
   - The collaboration server intercepts the HTTP upgrade request and extracts the token from query parameters or `Authorization` / cookie headers.
   - The token is verified using the shared secret. If invalid or expired, the WebSocket upgrade is rejected immediately with HTTP 401 Unauthorized.
   - Before binding the socket to the requested `pageId` room, the collaboration server queries the database (or permission cache) to verify that the user is an active member of the workspace and determines their effective permission level (`VIEW`, `COMMENT`, or `EDIT`).
   - If the user does not have access to the page, the connection is closed with code 4403 (Forbidden).
   - If the user has `VIEW` or `COMMENT` permission, they can listen to document updates and awareness, but any attempt to transmit document CRDT update messages will be dropped/rejected.

4. **Revocation & Access Removal**:
   - When a member is removed from a workspace or their permissions are downgraded, an invalidation message is published to Redis (`collab:auth:revoke` or `collab:page:<pageId>:kick`).
   - All collaboration server instances inspect their active sockets and disconnect the revoked user immediately.

## Consequences

- Single, consistent identity verification across both REST and WebSocket layers.
- Security by default: no anonymous or unauthenticated connections are ever admitted to document rooms.
