import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma, WorkspaceRole } from "@collab/db";
import { app } from "../app.js";

describe("Page hierarchy and permission API", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let ownerId = "";
  let outsiderId = "";
  let ownerToken = "";
  let memberId = "";
  let memberToken = "";
  let outsiderToken = "";
  let workspaceId = "";
  let otherWorkspaceId = "";
  let rootPageId = "";
  let childPageId = "";
  let otherPageId = "";
  let commentId = "";

  const accessTokenFrom = (headers: string[] | string | undefined) => {
    const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
    const cookie = values.find((value) => value.startsWith("accessToken="));
    return cookie?.split(";", 1)[0].slice("accessToken=".length) ?? "";
  };

  beforeAll(async () => {
    const owner = await request(app)
      .post("/api/auth/register")
      .send({
        email: `page_owner_${suffix}@example.com`,
        password: "Password123!",
        name: "Page Owner",
      });
    ownerToken = accessTokenFrom(owner.headers["set-cookie"]);
    ownerId = owner.body.data.user.id;

    const member = await request(app)
      .post("/api/auth/register")
      .send({
        email: `page_member_${suffix}@example.com`,
        password: "Password123!",
        name: "Page Member",
      });
    memberToken = accessTokenFrom(member.headers["set-cookie"]);
    memberId = member.body.data.user.id;

    const outsider = await request(app)
      .post("/api/auth/register")
      .send({
        email: `page_outsider_${suffix}@example.com`,
        password: "Password123!",
        name: "Page Outsider",
      });
    outsiderToken = accessTokenFrom(outsider.headers["set-cookie"]);
    outsiderId = outsider.body.data.user.id;

    const workspace = await request(app)
      .post("/api/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Pages under test" });
    workspaceId = workspace.body.data.id;
    const otherWorkspace = await request(app)
      .post("/api/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Other pages" });
    otherWorkspaceId = otherWorkspace.body.data.id;
    await prisma.workspaceMember.create({
      data: { workspaceId, userId: memberId, role: WorkspaceRole.MEMBER },
    });

    const root = await request(app)
      .post(`/api/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Root" });
    rootPageId = root.body.data.id;
    const child = await request(app)
      .post(`/api/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Child", parentId: rootPageId });
    childPageId = child.body.data.id;
    const other = await request(app)
      .post(`/api/workspaces/${otherWorkspaceId}/pages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Other" });
    otherPageId = other.body.data.id;
  });

  afterAll(async () => {
    for (const userId of [ownerId, memberId, outsiderId]) {
      if (!userId) continue;
      const workspaces = await prisma.workspace.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      for (const workspace of workspaces)
        await prisma.workspace
          .delete({ where: { id: workspace.id } })
          .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
  });

  it("returns a nested tree only to workspace members", async () => {
    const allowed = await request(app)
      .get(`/api/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(allowed.status).toBe(200);
    expect(
      allowed.body.data.find((page: { id: string }) => page.id === rootPageId)
        .children[0].id,
    ).toBe(childPageId);

    const denied = await request(app)
      .get(`/api/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(denied.status).toBe(404);
  });

  it("rejects cross-workspace parents and circular moves", async () => {
    const crossWorkspace = await request(app)
      .post(`/api/workspaces/${workspaceId}/pages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Invalid child", parentId: otherPageId });
    expect(crossWorkspace.status).toBe(400);

    const cycle = await request(app)
      .post(`/api/pages/${rootPageId}/move`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ targetParentId: childPageId });
    expect(cycle.status).toBe(400);
  });

  it("applies VIEW, COMMENT, and EDIT overrides to page reads", async () => {
    for (const permission of ["VIEW", "COMMENT", "EDIT"] as const) {
      const updated = await request(app)
        .put(`/api/pages/${rootPageId}/permissions`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userId: memberId, permission });
      expect(updated.status).toBe(200);
      const detail = await request(app)
        .get(`/api/pages/${rootPageId}`)
        .set("Authorization", `Bearer ${memberToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.effectivePermission).toBe(permission);
    }
  });

  it("does not allow a workspace member to change page metadata", async () => {
    const denied = await request(app)
      .patch(`/api/pages/${rootPageId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ title: "Unauthorized rename" });
    expect(denied.status).toBe(403);
  });

  it("enforces comment access and supports anchored replies and resolution", async () => {
    await request(app)
      .put(`/api/pages/${rootPageId}/permissions`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberId, permission: "VIEW" });
    const viewAttempt = await request(app)
      .post(`/api/pages/${rootPageId}/comments`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ content: "Not allowed yet" });
    expect(viewAttempt.status).toBe(403);

    await request(app)
      .put(`/api/pages/${rootPageId}/permissions`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberId, permission: "COMMENT" });
    const created = await request(app)
      .post(`/api/pages/${rootPageId}/comments`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        content: "Review this phrase",
        anchor: { from: 2, to: 8, text: "phrase" },
      });
    expect(created.status).toBe(201);
    commentId = created.body.data.id;
    expect(created.body.data.anchor).toEqual({
      from: 2,
      to: 8,
      text: "phrase",
    });

    const reply = await request(app)
      .post(`/api/comments/${commentId}/replies`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ content: "I will review it." });
    expect(reply.status).toBe(201);
    const resolved = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ isResolved: true });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.isResolved).toBe(true);

    const outsiderList = await request(app)
      .get(`/api/pages/${rootPageId}/comments`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(outsiderList.status).toBe(404);
  });
});
