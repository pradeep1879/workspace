# ADR 004: Permission Inheritance and Role Precedence

## Status

Accepted

## Context

A collaborative workspace requires multi-tenant security where access controls must be enforced consistently across workspaces, nested pages, comments, and real-time editing.

## Decision

1. **Workspace Roles**:
   - `OWNER`: Full administrative control. Can delete the workspace, transfer ownership, manage billing/settings, add/remove members, assign roles, and access/edit all pages.
   - `ADMIN`: Administrative control over members and settings. Can invite members, update roles (except owner), and access/edit all pages.
   - `MEMBER`: Standard workspace member. Can view workspaces and participate in pages according to workspace default permissions or page-specific overrides.

2. **Page Permission Levels**:
   - `VIEW`: Read-only access to page content and metadata. Cannot edit the document, cannot add comments.
   - `COMMENT`: Can read page content and view/add/resolve comments, but cannot edit the document content.
   - `EDIT`: Can read, comment, and make real-time edits to the document.

3. **Effective Permission Resolution Algorithm**:
   - **Step 1 - Workspace Membership**: If the user is not a member of the workspace owning the page, effective permission is `NONE` (access denied / 404 Not Found to prevent metadata leaks).
   - **Step 2 - Workspace Role Precedence**: If the user is `OWNER` or `ADMIN` in the workspace, effective permission is `EDIT` with full administrative privileges on the page (can also rename, move, delete, manage page permissions).
   - **Step 3 - Page-Specific Override**: Check `PagePermission` table for `(pageId, userId)`. If a specific rule exists, use that level (`VIEW`, `COMMENT`, `EDIT`).
   - **Step 4 - Default Page / Workspace Fallback**: If no specific user override exists, default to `EDIT` for workspace members (or workspace default page permission).

4. **Hierarchical / Move Invariants**:
   - Only workspace owners, admins, or users with explicit page manage permissions can rename, move, archive, or delete a page.
   - Circular moves (e.g. moving page A to be a child of page A or a descendant of page A) are strictly prevented with recursive cycle detection.
   - Moving a page across different workspaces is disallowed to preserve tenancy boundaries.

## Consequences

- Predictable and auditable permission matrix.
- Guaranteed protection of sensitive documents against unauthorized edits or leaks.
