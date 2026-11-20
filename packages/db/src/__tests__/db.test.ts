import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, WorkspaceRole, PagePermissionLevel } from "../index.js";

describe("Database Schema & Constraints Integration Suite", () => {
  let testUserId1: string;
  let testUserId2: string;
  let testWorkspaceId: string;

  beforeAll(async () => {
    // Create isolated test fixtures
    const user1 = await prisma.user.create({
      data: {
        email: `test_db_${Date.now()}_1@example.com`,
        passwordHash: "hash123",
        name: "DB Test User 1",
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: `test_db_${Date.now()}_2@example.com`,
        passwordHash: "hash123",
        name: "DB Test User 2",
      },
    });
    testUserId2 = user2.id;

    const ws = await prisma.workspace.create({
      data: {
        name: `Test Workspace ${Date.now()}`,
        ownerId: testUserId1,
      },
    });
    testWorkspaceId = ws.id;
  });

  afterAll(async () => {
    // Cleanup test fixtures
    if (testWorkspaceId) {
      await prisma.workspace
        .delete({ where: { id: testWorkspaceId } })
        .catch(() => {});
    }
    if (testUserId1) {
      await prisma.user.delete({ where: { id: testUserId1 } }).catch(() => {});
    }
    if (testUserId2) {
      await prisma.user.delete({ where: { id: testUserId2 } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("enforces unique email constraint on User", async () => {
    const existing = await prisma.user.findUnique({
      where: { id: testUserId1 },
    });
    expect(existing).toBeDefined();

    await expect(
      prisma.user.create({
        data: {
          email: existing!.email,
          passwordHash: "hash_duplicate",
          name: "Duplicate Email User",
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces unique workspaceId_userId constraint on WorkspaceMember", async () => {
    // Create initial membership
    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspaceId,
        userId: testUserId1,
        role: WorkspaceRole.OWNER,
      },
    });

    // Attempt duplicate membership
    await expect(
      prisma.workspaceMember.create({
        data: {
          workspaceId: testWorkspaceId,
          userId: testUserId1,
          role: WorkspaceRole.MEMBER,
        },
      }),
    ).rejects.toThrow();
  });

  it("stores and retrieves raw binary data in DocumentState without corruption", async () => {
    const testPage = await prisma.page.create({
      data: {
        workspaceId: testWorkspaceId,
        creatorId: testUserId1,
        title: "Binary Storage Test Page",
      },
    });

    const binaryData = Buffer.from([0x00, 0xff, 0x12, 0x34, 0xaa, 0x55, 0xef]);
    await prisma.documentState.create({
      data: {
        pageId: testPage.id,
        state: binaryData,
        version: 1,
      },
    });

    const retrieved = await prisma.documentState.findUnique({
      where: { pageId: testPage.id },
    });

    expect(retrieved).toBeDefined();
    expect(Buffer.compare(retrieved!.state, binaryData)).toBe(0);
  });

  it("enforces unique pageId_userId constraint on PagePermission", async () => {
    const testPage = await prisma.page.create({
      data: {
        workspaceId: testWorkspaceId,
        creatorId: testUserId1,
        title: "Permission Test Page",
      },
    });

    await prisma.pagePermission.create({
      data: {
        pageId: testPage.id,
        userId: testUserId2,
        permission: PagePermissionLevel.COMMENT,
      },
    });

    // Attempt duplicate permission record
    await expect(
      prisma.pagePermission.create({
        data: {
          pageId: testPage.id,
          userId: testUserId2,
          permission: PagePermissionLevel.VIEW,
        },
      }),
    ).rejects.toThrow();
  });

  it("cascades deletion of child records when workspace is deleted", async () => {
    const tempWs = await prisma.workspace.create({
      data: {
        name: "Temp WS For Cascade",
        ownerId: testUserId1,
      },
    });

    const tempPage = await prisma.page.create({
      data: {
        workspaceId: tempWs.id,
        creatorId: testUserId1,
        title: "Temp Page",
      },
    });

    await prisma.documentState.create({
      data: {
        pageId: tempPage.id,
        state: Buffer.from([1, 2, 3]),
      },
    });

    // Delete workspace
    await prisma.workspace.delete({ where: { id: tempWs.id } });

    // Assert page and documentState were cascaded
    const pageCheck = await prisma.page.findUnique({
      where: { id: tempPage.id },
    });
    expect(pageCheck).toBeNull();

    const stateCheck = await prisma.documentState.findUnique({
      where: { pageId: tempPage.id },
    });
    expect(stateCheck).toBeNull();
  });
});
