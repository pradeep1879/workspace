import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "@collab/db";
import { app } from "../app.js";

describe("Authentication & Session API Integration Suite", () => {
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = "SecurePassword123!";
  const testName = "Auth Test User";

  let accessToken: string;
  let refreshCookie: string;
  let userId: string;

  const cookie = (headers: string[] | string | undefined, name: string) => {
    const entries = Array.isArray(headers) ? headers : headers ? [headers] : [];
    return (
      entries.find((entry) => entry.startsWith(`${name}=`))?.split(";", 1)[0] ??
      ""
    );
  };

  afterAll(async () => {
    // Cleanup created test user and associated sessions/workspaces
    if (userId) {
      // Find workspaces owned by user
      const workspaces = await prisma.workspace.findMany({
        where: { ownerId: userId },
      });
      for (const ws of workspaces) {
        await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => {});
      }
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  describe("POST /api/auth/register", () => {
    it("successfully registers a new user and creates default workspace", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: testEmail,
        password: testPassword,
        name: testName,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user.name).toBe(testName);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
      expect(res.headers["set-cookie"]).toBeDefined();

      userId = res.body.data.user.id;
      accessToken = cookie(res.headers["set-cookie"], "accessToken").slice(
        "accessToken=".length,
      );
      refreshCookie = cookie(res.headers["set-cookie"], "refreshToken");

      // Verify default workspace was created and user is OWNER
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toBe("OWNER");
    });

    it("rejects registration with duplicate email (409 Conflict)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: testEmail,
        password: testPassword,
        name: "Another Name",
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("rejects registration with invalid input (400 Bad Request)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "invalid-email",
        password: "123", // too short
        name: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.details).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    it("successfully logs in with valid credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
      expect(res.headers["set-cookie"]).toBeDefined();

      // Update tokens
      accessToken = cookie(res.headers["set-cookie"], "accessToken").slice(
        "accessToken=".length,
      );
      refreshCookie = cookie(res.headers["set-cookie"], "refreshToken");
    });

    it("rejects login with invalid password (401 Unauthorized)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: "WrongPassword!",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects login with non-existent email (401 Unauthorized)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nobody_1234567@example.com",
        password: testPassword,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns current user profile with valid Bearer token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.email).toBe(testEmail.toLowerCase());
    });

    it("rejects request with invalid token (401 Unauthorized)", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid_fake_token_value");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects request without token (401 Unauthorized)", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("refreshes access token with valid refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeUndefined();
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    });

    it("rejects refresh with invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "fake_refresh_token_value" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("revokes session on logout", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", refreshCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Attempting to refresh with the revoked token should now fail
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe("UNAUTHORIZED");

      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(meRes.status).toBe(401);
    });
  });
});
