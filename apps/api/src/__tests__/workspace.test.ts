import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "@collab/db";
import { app } from "../app.js";

describe("Workspace & Membership Management API Integration Suite", () => {
  let ownerToken: string;
  let ownerId: string;

  let memberToken: string;
  let memberId: string;
  let memberEmail: string;

  let outsiderToken: string;
  let outsiderId: string;

  let testWorkspaceId: string;
  let memberRecordId: string;
  let ownerRecordId: string;

  const accessTokenFrom = (headers: string[] | string | undefined) => {
    const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
    const cookie = values.find((value) => value.startsWith("accessToken="));
    return cookie?.split(";", 1)[0].slice("accessToken=".length) ?? "";
  };

  beforeAll(async () => {
    // 1. Register owner
    const ownerRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: `ws_owner_${Date.now()}@example.com`,
        password: "Password123!",
        name: "Workspace Owner",
      });
    ownerToken = accessTokenFrom(ownerRes.headers["set-cookie"]);
    ownerId = ownerRes.body.data.user.id;

    // 2. Register member
    memberEmail = `ws_member_${Date.now()}@example.com`;
    const memberRes = await request(app).post("/api/auth/register").send({
      email: memberEmail,
      password: "Password123!",
      name: "Workspace Member",
    });
    memberToken = accessTokenFrom(memberRes.headers["set-cookie"]);
    memberId = memberRes.body.data.user.id;

    // 3. Register outsider
    const outsiderRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: `ws_outsider_${Date.now()}@example.com`,
        password: "Password123!",
        name: "Workspace Outsider",
      });
    outsiderToken = accessTokenFrom(outsiderRes.headers["set-cookie"]);
    outsiderId = outsiderRes.body.data.user.id;
  });

  afterAll(async () => {
    // Cleanup workspaces and test users
    if (testWorkspaceId) {
      await prisma.workspace
        .delete({ where: { id: testWorkspaceId } })
        .catch(() => {});
    }
    for (const uid of [ownerId, memberId, outsiderId]) {
      if (uid) {
        const wsList = await prisma.workspace.findMany({
          where: { ownerId: uid },
        });
        for (const ws of wsList) {
          await prisma.workspace
            .delete({ where: { id: ws.id } })
            .catch(() => {});
        }
        await prisma.user.delete({ where: { id: uid } }).catch(() => {});
      }
    }
  });

  describe("Workspace Creation & Access Control", () => {
    it("creates a workspace and assigns OWNER role to the creator", async () => {
      const res = await request(app)
        .post("/api/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Acme Test Labs" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Acme Test Labs");
      expect(res.body.data.role).toBe("OWNER");

      testWorkspaceId = res.body.data.id;

      // Find owner record id
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: testWorkspaceId },
      });
      const ownerRecord = members.find((m) => m.userId === ownerId);
      ownerRecordId = ownerRecord!.id;
    });

    it("lists only workspaces the user belongs to", async () => {
      const ownerList = await request(app)
        .get("/api/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(ownerList.status).toBe(200);
      const hasWorkspace = ownerList.body.data.some(
        (w: any) => w.id === testWorkspaceId,
      );
      expect(hasWorkspace).toBe(true);

      const outsiderList = await request(app)
        .get("/api/workspaces")
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(outsiderList.status).toBe(200);
      const outsiderHasIt = outsiderList.body.data.some(
        (w: any) => w.id === testWorkspaceId,
      );
      expect(outsiderHasIt).toBe(false);
    });

    it("prevents non-members from reading workspace details (404/denied)", async () => {
      const res = await request(app)
        .get(`/api/workspaces/${testWorkspaceId}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Invitations & Member Management", () => {
    let inviteToken: string;

    it("allows OWNER to create an invitation", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspaceId}/invitations`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: memberEmail, role: "MEMBER" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      inviteToken = res.body.data.token;
    });

    it("allows invited user to accept invitation and join workspace", async () => {
      const denied = await request(app)
        .post(`/api/workspaces/invitations/${inviteToken}/accept`)
        .set("Authorization", `Bearer ${outsiderToken}`);
      expect(denied.status).toBe(403);

      const res = await request(app)
        .post(`/api/workspaces/invitations/${inviteToken}/accept`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.member.role).toBe("MEMBER");

      memberRecordId = res.body.data.member.id;
    });

    it("prevents regular MEMBER from inviting others (403 Forbidden)", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspaceId}/invitations`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ email: "someone_else@example.com", role: "MEMBER" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("allows OWNER to promote member to ADMIN", async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${testWorkspaceId}/members/${memberRecordId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "ADMIN" });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe("ADMIN");
    });

    it("enforces ownership invariant: cannot demote sole remaining owner", async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${testWorkspaceId}/members/${ownerRecordId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "MEMBER" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain(
        "Cannot demote the last remaining owner",
      );
    });

    it("enforces ownership invariant: cannot remove sole remaining owner", async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${testWorkspaceId}/members/${ownerRecordId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain(
        "Cannot remove the last remaining owner",
      );
    });
  });

  describe("Workspace Modification & Deletion", () => {
    it("allows OWNER or ADMIN to rename workspace", async () => {
      const res = await request(app)
        .patch(`/api/workspaces/${testWorkspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Acme Test Labs Renamed" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Acme Test Labs Renamed");
    });

    it("prevents non-owners from deleting workspace", async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${testWorkspaceId}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("allows OWNER to delete workspace and cascades cleanly", async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${testWorkspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      const check = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
      });
      expect(check).toBeNull();
    });
  });
});
