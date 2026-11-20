import { PagePermissionLevel, WorkspaceRole, prisma } from "@collab/db";
import {
  CreatePageInput,
  ErrorCode,
  MovePageInput,
  PagePermissionLevelType,
  SetPagePermissionInput,
  UpdatePageInput,
} from "@collab/contracts";
import { AppError } from "../middleware/errorHandler.js";

const rank: Record<PagePermissionLevelType, number> = {
  VIEW: 1,
  COMMENT: 2,
  EDIT: 3,
};

export class PageService {
  async effectivePermission(
    pageId: string,
    userId: string,
  ): Promise<PagePermissionLevelType> {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { id: true, workspaceId: true, isArchived: true },
    });
    if (!page || page.isArchived)
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        "Page not found or access denied",
      );

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: page.workspaceId, userId } },
      select: { role: true },
    });
    if (!membership)
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        "Page not found or access denied",
      );
    if (
      membership.role === WorkspaceRole.OWNER ||
      membership.role === WorkspaceRole.ADMIN
    )
      return "EDIT";

    const override = await prisma.pagePermission.findUnique({
      where: { pageId_userId: { pageId, userId } },
      select: { permission: true },
    });
    return (override?.permission ??
      PagePermissionLevel.EDIT) as PagePermissionLevelType;
  }

  async requirePermission(
    pageId: string,
    userId: string,
    minimum: PagePermissionLevelType,
  ) {
    const permission = await this.effectivePermission(pageId, userId);
    if (rank[permission] < rank[minimum]) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        `${minimum} permission is required for this page`,
      );
    }
    return permission;
  }

  private async requireWorkspaceManager(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!member)
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        "Workspace not found or access denied",
      );
    if (
      member.role !== WorkspaceRole.OWNER &&
      member.role !== WorkspaceRole.ADMIN
    ) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Workspace administrator permission is required",
      );
    }
  }

  async listTree(workspaceId: string, userId: string) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!membership)
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        "Workspace not found or access denied",
      );
    const allPages = await prisma.page.findMany({
      where: { workspaceId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const allById = new Map(allPages.map((page) => [page.id, page]));
    const isVisible = (pageId: string) => {
      const visited = new Set<string>();
      let current = allById.get(pageId);
      while (current) {
        if (current.isArchived || visited.has(current.id)) return false;
        visited.add(current.id);
        if (!current.parentId) return true;
        current = allById.get(current.parentId);
      }
      return false;
    };
    const pages = allPages.filter((page) => isVisible(page.id));
    const overrides =
      membership.role === WorkspaceRole.OWNER ||
      membership.role === WorkspaceRole.ADMIN
        ? []
        : await prisma.pagePermission.findMany({
            where: { userId, pageId: { in: pages.map((page) => page.id) } },
          });
    const permissionByPage = new Map(
      overrides.map((item) => [
        item.pageId,
        item.permission as PagePermissionLevelType,
      ]),
    );
    const visible = pages.map((page) => ({
      ...page,
      effectivePermission:
        membership.role === WorkspaceRole.OWNER ||
        membership.role === WorkspaceRole.ADMIN
          ? ("EDIT" as const)
          : (permissionByPage.get(page.id) ?? ("EDIT" as const)),
      children: [] as Array<Record<string, unknown>>,
    }));
    const byId = new Map(visible.map((page) => [page.id, page]));
    const roots: typeof visible = [];
    for (const page of visible) {
      const parent = page.parentId ? byId.get(page.parentId) : undefined;
      if (parent) parent.children.push(page);
      else roots.push(page);
    }
    return roots;
  }

  async create(workspaceId: string, userId: string, input: CreatePageInput) {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    if (!membership)
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        "Workspace not found or access denied",
      );
    if (input.parentId) {
      const parent = await prisma.page.findUnique({
        where: { id: input.parentId },
        select: { workspaceId: true },
      });
      if (!parent || parent.workspaceId !== workspaceId)
        throw new AppError(
          400,
          ErrorCode.BAD_REQUEST,
          "Parent page must belong to this workspace",
        );
      await this.requirePermission(input.parentId, userId, "EDIT");
    }
    const siblings = await prisma.page.count({
      where: {
        workspaceId,
        parentId: input.parentId ?? null,
        isArchived: false,
      },
    });
    return prisma.page.create({
      data: {
        workspaceId,
        creatorId: userId,
        parentId: input.parentId ?? null,
        title: input.title,
        icon: input.icon,
        position: (siblings + 1) * 1000,
      },
    });
  }

  async get(pageId: string, userId: string) {
    const effectivePermission = await this.requirePermission(
      pageId,
      userId,
      "VIEW",
    );
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page || page.isArchived)
      throw new AppError(404, ErrorCode.NOT_FOUND, "Page not found");
    return { ...page, effectivePermission };
  }

  async update(pageId: string, userId: string, input: UpdatePageInput) {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });
    if (!page) throw new AppError(404, ErrorCode.NOT_FOUND, "Page not found");
    await this.requireWorkspaceManager(page.workspaceId, userId);
    return prisma.page.update({ where: { id: pageId }, data: input });
  }

  async move(pageId: string, userId: string, input: MovePageInput) {
    return prisma.$transaction(
      async (tx) => {
        const page = await tx.page.findUnique({
          where: { id: pageId },
          select: { workspaceId: true },
        });
        if (!page)
          throw new AppError(404, ErrorCode.NOT_FOUND, "Page not found");
        const manager = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId: page.workspaceId, userId },
          },
          select: { role: true },
        });
        if (!manager)
          throw new AppError(
            404,
            ErrorCode.NOT_FOUND,
            "Workspace not found or access denied",
          );
        if (
          manager.role !== WorkspaceRole.OWNER &&
          manager.role !== WorkspaceRole.ADMIN
        ) {
          throw new AppError(
            403,
            ErrorCode.FORBIDDEN,
            "Workspace administrator permission is required",
          );
        }
        if (input.targetParentId) {
          const parent = await tx.page.findUnique({
            where: { id: input.targetParentId },
            select: { workspaceId: true, parentId: true, isArchived: true },
          });
          if (
            !parent ||
            parent.workspaceId !== page.workspaceId ||
            parent.isArchived
          ) {
            throw new AppError(
              400,
              ErrorCode.BAD_REQUEST,
              "Target parent must be an active page in this workspace",
            );
          }
          let currentId: string | null = input.targetParentId;
          const visited = new Set<string>();
          while (currentId) {
            if (currentId === pageId)
              throw new AppError(
                400,
                ErrorCode.BAD_REQUEST,
                "A page cannot be moved beneath itself or its descendants",
              );
            if (visited.has(currentId))
              throw new AppError(
                409,
                ErrorCode.CONFLICT,
                "Existing page hierarchy contains a cycle",
              );
            visited.add(currentId);
            const ancestor: { parentId: string | null } | null =
              await tx.page.findUnique({
                where: { id: currentId },
                select: { parentId: true },
              });
            currentId = ancestor?.parentId ?? null;
          }
        }
        return tx.page.update({
          where: { id: pageId },
          data: {
            parentId: input.targetParentId,
            ...(input.position === undefined
              ? {}
              : { position: input.position }),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async remove(pageId: string, userId: string) {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });
    if (!page) throw new AppError(404, ErrorCode.NOT_FOUND, "Page not found");
    await this.requireWorkspaceManager(page.workspaceId, userId);
    await prisma.page.delete({ where: { id: pageId } });
    return { id: pageId, deleted: true };
  }

  async setPermission(
    pageId: string,
    userId: string,
    input: SetPagePermissionInput,
  ) {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });
    if (!page) throw new AppError(404, ErrorCode.NOT_FOUND, "Page not found");
    await this.requireWorkspaceManager(page.workspaceId, userId);
    const target = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: page.workspaceId,
          userId: input.userId,
        },
      },
      select: { id: true },
    });
    if (!target)
      throw new AppError(
        400,
        ErrorCode.BAD_REQUEST,
        "Page permissions can only be assigned to workspace members",
      );
    return prisma.pagePermission.upsert({
      where: { pageId_userId: { pageId, userId: input.userId } },
      create: {
        pageId,
        userId: input.userId,
        permission: input.permission as PagePermissionLevel,
      },
      update: { permission: input.permission as PagePermissionLevel },
    });
  }

  async listPermissions(pageId: string, userId: string) {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });
    if (!page) throw new AppError(404, ErrorCode.NOT_FOUND, "Page not found");
    await this.requireWorkspaceManager(page.workspaceId, userId);
    return prisma.pagePermission.findMany({
      where: { pageId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

export const pageService = new PageService();
