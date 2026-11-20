# 10-minute project presentation

> **Status:** Draft aligned to implemented code. Database, authentication, and multi-client collaboration runtime checks remain outstanding; do not claim a verified live demo until those checks pass.

## 0:00–1:00 — The problem

Teams often split notes, decisions, and review comments across tools. This project aims to give a team one workspace with nested pages, controlled access, and eventually concurrent editing in the same document.

## 1:00–2:00 — Product goals

Walk through the required journey: create an account, create or join a workspace, organize nested pages, invite teammates, grant view/comment/edit access, and discuss a page. The end goal also includes concurrent editing, presence, history, and multi-instance scaling.

## 2:00–3:00 — Current architecture

Show [the architecture diagram](architecture.md). The implemented code path is React/Tiptap/Yjs → Hocuspocus → PostgreSQL, with Redis for cross-instance synchronization, alongside Express REST API and Prisma. Runtime acceptance remains pending.

## 3:00–4:00 — Authentication and security

Explain password hashing, HTTP-only access/refresh cookies, session records, and per-request database session checks. Logout revokes the session so existing access tokens stop working. Auth responses return profiles rather than token strings.

## 4:00–5:00 — Workspaces and pages

Show workspace selection, member roles, invitation codes bound to email, the nested page tree, and page-level VIEW/COMMENT/EDIT overrides. Explain that authorization lives in server services as well as in the UI.

## 5:00–6:00 — Comments

Demonstrate comment creation, replies, resolve/reopen, and the permission rules. Anchors are supported by the API model, while editor selection integration depends on the Tiptap phase.

## 6:00–7:00 — Collaboration design

Explain the Yjs/Tiptap data flow: clients exchange CRDT updates over authenticated WebSockets; Yjs merges concurrent operations. The editor and collaboration server are implemented. Describe these as code features until two-client runtime verification is complete.

## 7:00–8:00 — Persistence and scaling plan

PostgreSQL stores binary Yjs state in the implementation and Redis carries updates and awareness across collaboration instances. Snapshot history and restore remain future work. Persistence and multi-instance flows have not been demonstrated in this environment.

## 8:00–9:00 — Engineering evidence and current limits

Typecheck, production build, formatting, contract tests, and auth form tests pass. Database/API integration tests require PostgreSQL and socket access unavailable in the current workspace session. The package registry did not respond during required Tiptap/Yjs dependency installation; record actual test/demo results when the environment is available.

## 9:00–10:00 — Demo and next steps

Demo account, workspace, member, page, permission, comment, and editor flows only after their live checks pass. Remaining work includes snapshot history, complete acceptance tests, production deployment, and a verified two-client collaboration demo.

## Speaker handoff

For a team presentation, assign one speaker each to product/workflows, backend/data/security, frontend, collaboration architecture, and testing/deployment. Replace each planned-feature explanation with a verified live demonstration only after the corresponding acceptance test passes.
