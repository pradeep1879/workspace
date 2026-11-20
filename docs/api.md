# REST API

Base URL: `http://localhost:4000`. Successful responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code", "message", "details?" } }`. Request bodies are validated with shared Zod schemas. Authentication routes set HTTP-only cookies; auth tokens are not returned in JSON.

## Authentication

| Method | Path                 | Access               | Purpose                                                   |
| ------ | -------------------- | -------------------- | --------------------------------------------------------- |
| POST   | `/api/auth/register` | Public, rate limited | Create an account, personal workspace, session cookies.   |
| POST   | `/api/auth/login`    | Public, rate limited | Start a session.                                          |
| POST   | `/api/auth/refresh`  | Refresh cookie       | Issue a new access cookie for the current active session. |
| POST   | `/api/auth/logout`   | Refresh cookie       | Revoke the session and clear auth cookies.                |
| GET    | `/api/auth/me`       | Authenticated        | Return the current user's profile.                        |

## Workspaces and membership

All routes below require authentication. A workspace is visible only to its members.

| Method | Path                                             | Purpose                                                              |
| ------ | ------------------------------------------------ | -------------------------------------------------------------------- |
| GET    | `/api/workspaces`                                | List the caller's workspaces.                                        |
| POST   | `/api/workspaces`                                | Create a workspace and owner membership. Body: `{ "name": string }`. |
| GET    | `/api/workspaces/:workspaceId`                   | Read workspace detail.                                               |
| PATCH  | `/api/workspaces/:workspaceId`                   | Rename workspace; owner/admin.                                       |
| DELETE | `/api/workspaces/:workspaceId`                   | Delete workspace; owner.                                             |
| GET    | `/api/workspaces/:workspaceId/members`           | List members.                                                        |
| POST   | `/api/workspaces/:workspaceId/invitations`       | Create an email-bound invitation; owner/admin.                       |
| POST   | `/api/workspaces/invitations/:token/accept`      | Accept invitation as the invited account.                            |
| PATCH  | `/api/workspaces/:workspaceId/members/:memberId` | Change role; owner/admin, last-owner protection.                     |
| DELETE | `/api/workspaces/:workspaceId/members/:memberId` | Remove member; owner/admin or self-removal, last-owner protection.   |

## Pages and permissions

All routes require authentication. Workspace membership is required. Effective page permission defaults to `EDIT` for ordinary members, unless a direct page override is set. Workspace owner/admin privileges take precedence.

| Method | Path                                 | Purpose                                                                                                       |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/workspaces/:workspaceId/pages` | Return active nested page tree.                                                                               |
| POST   | `/api/workspaces/:workspaceId/pages` | Create a root or child page; a child must be in the same workspace and caller must have `EDIT` on its parent. |
| GET    | `/api/pages/:pageId`                 | Read page for `VIEW` and above.                                                                               |
| PATCH  | `/api/pages/:pageId`                 | Rename/archive page; owner/admin.                                                                             |
| POST   | `/api/pages/:pageId/move`            | Move/reorder page; owner/admin; rejects cross-workspace targets and cycles. Body: `{ "targetParentId": string | null, "position?": number }`. |
| DELETE | `/api/pages/:pageId`                 | Delete page and descendants; owner/admin.                                                                     |
| GET    | `/api/pages/:pageId/permissions`     | List direct permission overrides; owner/admin.                                                                |
| PUT    | `/api/pages/:pageId/permissions`     | Upsert `{ "userId": string, "permission": "VIEW"                                                              | "COMMENT"                     | "EDIT" }`; owner/admin. Target must be a workspace member. |

## Comments

All routes require authentication. Listing requires `VIEW`; creating and replying require `COMMENT` or `EDIT`. A comment author or workspace admin/owner can manage a comment.

| Method | Path                               | Purpose                                                                                       |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/api/pages/:pageId/comments`      | List comments and replies.                                                                    |
| POST   | `/api/pages/:pageId/comments`      | Create `{ "content": string, "anchor?": { "from": number, "to": number, "text?": string } }`. |
| POST   | `/api/comments/:commentId/replies` | Add `{ "content": string }` reply.                                                            |
| PATCH  | `/api/comments/:commentId`         | Edit own content or set `isResolved`; admins can resolve/reopen.                              |
| DELETE | `/api/comments/:commentId`         | Delete own comment or admin-managed comment.                                                  |

## Collaboration service

The Hocuspocus WebSocket service runs separately from the REST API. Set `COLLAB_PORT`, `COLLAB_URL`, and `COLLAB_ALLOWED_ORIGINS` in the environment. The client joins a room named by page ID and authenticates with its HTTP-only access cookie. The service checks the active database session, workspace membership, and effective page permission on connection and during the connection lifetime. `VIEW` and `COMMENT` connections are read-only. Yjs state loads from and saves to PostgreSQL; Redis distributes updates and awareness between server instances. This code path compiles, but database persistence, cookie-based WebSocket authentication, and cross-instance synchronization have not passed runtime acceptance tests in this environment.

Snapshot/version history endpoints and restore are not implemented.
