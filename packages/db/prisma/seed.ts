import {
  PrismaClient,
  WorkspaceRole,
  PagePermissionLevel,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("🌱 Starting database seeding...");

  // Hash standard test password
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Seed Users
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: { name: "Alice Walker", passwordHash },
    create: {
      email: "alice@example.com",
      name: "Alice Walker",
      passwordHash,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: { name: "Bob Smith", passwordHash },
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
      passwordHash,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: "charlie@example.com" },
    update: { name: "Charlie Kim", passwordHash },
    create: {
      email: "charlie@example.com",
      name: "Charlie Kim",
      passwordHash,
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
    },
  });

  console.log(`✓ Seeded users: ${alice.email}, ${bob.email}, ${charlie.email}`);

  // 2. Seed Workspace
  let workspace = await prisma.workspace.findFirst({
    where: { name: "Acme Engineering Workspace", ownerId: alice.id },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Acme Engineering Workspace",
        ownerId: alice.id,
      },
    });
  }

  console.log(`✓ Seeded workspace: ${workspace.name} (${workspace.id})`);

  // 3. Seed Workspace Members
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: alice.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: alice.id,
      role: WorkspaceRole.OWNER,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: bob.id,
      },
    },
    update: { role: WorkspaceRole.ADMIN },
    create: {
      workspaceId: workspace.id,
      userId: bob.id,
      role: WorkspaceRole.ADMIN,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: charlie.id,
      },
    },
    update: { role: WorkspaceRole.MEMBER },
    create: {
      workspaceId: workspace.id,
      userId: charlie.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  console.log("✓ Seeded workspace memberships");

  // 4. Seed Hierarchical Pages
  // Root Page: Engineering Handbook
  let handbookPage = await prisma.page.findFirst({
    where: { workspaceId: workspace.id, title: "Engineering Handbook" },
  });

  if (!handbookPage) {
    handbookPage = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        creatorId: alice.id,
        title: "Engineering Handbook",
        icon: "📘",
        position: 1000,
      },
    });
  }

  // Child Page: Architecture & Standards
  let archPage = await prisma.page.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: handbookPage.id,
      title: "Architecture & Standards",
    },
  });

  if (!archPage) {
    archPage = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        parentId: handbookPage.id,
        creatorId: alice.id,
        title: "Architecture & Standards",
        icon: "🏛️",
        position: 1000,
      },
    });
  }

  // Grandchild Page: Coding Guidelines
  let guidelinesPage = await prisma.page.findFirst({
    where: {
      workspaceId: workspace.id,
      parentId: archPage.id,
      title: "Coding Guidelines",
    },
  });

  if (!guidelinesPage) {
    guidelinesPage = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        parentId: archPage.id,
        creatorId: bob.id,
        title: "Coding Guidelines",
        icon: "📐",
        position: 1000,
      },
    });
  }

  // Another Root Page: Product Roadmap Q4
  let roadmapPage = await prisma.page.findFirst({
    where: { workspaceId: workspace.id, title: "Product Roadmap Q4" },
  });

  if (!roadmapPage) {
    roadmapPage = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        creatorId: alice.id,
        title: "Product Roadmap Q4",
        icon: "🚀",
        position: 2000,
      },
    });
  }

  console.log("✓ Seeded page tree hierarchy");

  // 5. Seed Page Permissions (Charlie has VIEW-only on Product Roadmap)
  await prisma.pagePermission.upsert({
    where: {
      pageId_userId: {
        pageId: roadmapPage.id,
        userId: charlie.id,
      },
    },
    update: { permission: PagePermissionLevel.VIEW },
    create: {
      pageId: roadmapPage.id,
      userId: charlie.id,
      permission: PagePermissionLevel.VIEW,
    },
  });

  // 6. Seed DocumentState (dummy binary Yjs byte buffer)
  const initialYjsState = Buffer.from([0, 0, 1, 2, 3, 4, 5]);
  await prisma.documentState.upsert({
    where: { pageId: handbookPage.id },
    update: { state: initialYjsState, version: 1 },
    create: {
      pageId: handbookPage.id,
      state: initialYjsState,
      version: 1,
    },
  });

  await prisma.documentState.upsert({
    where: { pageId: roadmapPage.id },
    update: { state: initialYjsState, version: 1 },
    create: {
      pageId: roadmapPage.id,
      state: initialYjsState,
      version: 1,
    },
  });

  // 7. Seed Comments & Replies
  let comment = await prisma.comment.findFirst({
    where: { pageId: handbookPage.id, authorId: bob.id },
  });

  if (!comment) {
    comment = await prisma.comment.create({
      data: {
        pageId: handbookPage.id,
        authorId: bob.id,
        content: "Great start on the documentation!",
        anchorFrom: 0,
        anchorTo: 10,
        anchorText: "Engineering",
      },
    });

    await prisma.commentReply.create({
      data: {
        commentId: comment.id,
        authorId: alice.id,
        content: "Thanks Bob! Let me know if anything needs updating.",
      },
    });
  }

  // 8. Seed Document Snapshot
  let snapshot = await prisma.documentSnapshot.findFirst({
    where: { pageId: handbookPage.id, label: "Initial release draft" },
  });

  if (!snapshot) {
    await prisma.documentSnapshot.create({
      data: {
        pageId: handbookPage.id,
        creatorId: alice.id,
        label: "Initial release draft",
        state: initialYjsState,
        preview: "Initial handbook draft content preview",
      },
    });
  }

  // 9. Seed Pending Invitation
  const inviteTokenHash = await bcrypt.hash("invite-token-secret-123", 10);
  const existingInvite = await prisma.invitation.findFirst({
    where: { workspaceId: workspace.id, email: "dev-intern@example.com" },
  });

  if (!existingInvite) {
    await prisma.invitation.create({
      data: {
        workspaceId: workspace.id,
        email: "dev-intern@example.com",
        role: WorkspaceRole.MEMBER,
        tokenHash: inviteTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
