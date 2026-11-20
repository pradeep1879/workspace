import crypto from "crypto";
import { prisma, WorkspaceRole } from "@collab/db";
import {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  ErrorCode,
} from "@collab/contracts";
import { AppError } from "../middleware/errorHandler.js";

export class WorkspaceService {
  private hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  async getMemberRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole | null> {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
    return member?.role || null;
  }

  async requireMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole> {
    const role = await this.getMemberRole(workspaceId, userId);
    if (!role) {
      throw new AppError(
        404,
        ErrorCode.NOT_FOUND,
        "Workspace not found or access denied",
      );
    }
    return role;
  }

  async requireAdminOrOwner(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole> {
    const role = await this.requireMembership(workspaceId, userId);
    if (role !== WorkspaceRole.OWNER && role !== WorkspaceRole.ADMIN) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Only workspace owners and administrators can perform this action",
      );
    }
    return role;
  }

  async listWorkspacesForUser(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                pages: { where: { isArchived: false } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      ownerId: m.workspace.ownerId,
      role: m.role,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
      _count: m.workspace._count,
    }));
  }

  async getWorkspaceDetail(workspaceId: string, userId: string) {
    const role = await this.requireMembership(workspaceId, userId);
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: {
          select: {
            members: true,
            pages: { where: { isArchived: false } },
          },
        },
      },
    });

    if (!workspace) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Workspace not found");
    }

    return {
      ...workspace,
      role,
    };
  }

  async createWorkspace(input: CreateWorkspaceInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });

      // Default first page
      await tx.page.create({
        data: {
          workspaceId: workspace.id,
          creatorId: userId,
          title: "Welcome to " + input.name,
          icon: "✨",
          position: 1000,
        },
      });

      return {
        ...workspace,
        role: WorkspaceRole.OWNER,
      };
    });
  }

  async updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceInput,
    userId: string,
  ) {
    await this.requireAdminOrOwner(workspaceId, userId);

    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: input.name },
    });
  }

  async deleteWorkspace(workspaceId: string, userId: string) {
    const role = await this.requireMembership(workspaceId, userId);
    if (role !== WorkspaceRole.OWNER) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Only the workspace owner can delete the workspace",
      );
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
    return { id: workspaceId, deleted: true };
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId);

    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
    actorUserId: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const actor = await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: actorUserId } },
          select: { role: true },
        });
        if (
          !actor ||
          (actor.role !== WorkspaceRole.OWNER &&
            actor.role !== WorkspaceRole.ADMIN)
        ) {
          throw new AppError(
            403,
            ErrorCode.FORBIDDEN,
            "Only workspace owners and administrators can perform this action",
          );
        }

        const targetMember = await tx.workspaceMember.findUnique({
          where: { id: memberId },
        });
        if (!targetMember || targetMember.workspaceId !== workspaceId) {
          throw new AppError(
            404,
            ErrorCode.NOT_FOUND,
            "Member not found in this workspace",
          );
        }
        if (
          actor.role === WorkspaceRole.ADMIN &&
          targetMember.role === WorkspaceRole.OWNER
        ) {
          throw new AppError(
            403,
            ErrorCode.FORBIDDEN,
            "Administrators cannot alter owner roles",
          );
        }
        if (
          actor.role === WorkspaceRole.ADMIN &&
          input.role === WorkspaceRole.OWNER
        ) {
          throw new AppError(
            403,
            ErrorCode.FORBIDDEN,
            "Only owners can transfer or grant owner role",
          );
        }
        if (
          targetMember.role === WorkspaceRole.OWNER &&
          input.role !== WorkspaceRole.OWNER
        ) {
          const ownerCount = await tx.workspaceMember.count({
            where: { workspaceId, role: WorkspaceRole.OWNER },
          });
          if (ownerCount <= 1)
            throw new AppError(
              400,
              ErrorCode.BAD_REQUEST,
              "Cannot demote the last remaining owner of the workspace",
            );
        }

        return tx.workspaceMember.update({
          where: { id: memberId },
          data: { role: input.role },
          include: {
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const actor = await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: actorUserId } },
          select: { role: true },
        });
        if (!actor)
          throw new AppError(
            404,
            ErrorCode.NOT_FOUND,
            "Workspace not found or access denied",
          );

        const targetMember = await tx.workspaceMember.findUnique({
          where: { id: memberId },
        });
        if (!targetMember || targetMember.workspaceId !== workspaceId) {
          throw new AppError(
            404,
            ErrorCode.NOT_FOUND,
            "Member not found in this workspace",
          );
        }
        const isSelfRemoval = targetMember.userId === actorUserId;
        if (
          !isSelfRemoval &&
          actor.role !== WorkspaceRole.OWNER &&
          actor.role !== WorkspaceRole.ADMIN
        ) {
          throw new AppError(
            403,
            ErrorCode.FORBIDDEN,
            "Insufficient permissions to remove members",
          );
        }
        if (
          !isSelfRemoval &&
          actor.role === WorkspaceRole.ADMIN &&
          targetMember.role === WorkspaceRole.OWNER
        ) {
          throw new AppError(
            403,
            ErrorCode.FORBIDDEN,
            "Administrators cannot remove the owner",
          );
        }
        if (targetMember.role === WorkspaceRole.OWNER) {
          const ownerCount = await tx.workspaceMember.count({
            where: { workspaceId, role: WorkspaceRole.OWNER },
          });
          if (ownerCount <= 1)
            throw new AppError(
              400,
              ErrorCode.BAD_REQUEST,
              "Cannot remove the last remaining owner of the workspace",
            );
        }
        await tx.workspaceMember.delete({ where: { id: memberId } });
        return { id: memberId, removed: true };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async createInvitation(
    workspaceId: string,
    input: InviteMemberInput,
    actorUserId: string,
  ) {
    await this.requireAdminOrOwner(workspaceId, actorUserId);

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
      });
      if (existingMember) {
        throw new AppError(
          409,
          ErrorCode.CONFLICT,
          "User is already a member of this workspace",
        );
      }
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        workspaceId,
        email: input.email,
        role: input.role,
        tokenHash,
        expiresAt,
      },
    });

    return {
      invitation,
      token: rawToken,
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { workspace: true },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt < new Date()
    ) {
      throw new AppError(
        400,
        ErrorCode.BAD_REQUEST,
        "Invalid or expired invitation token",
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "This invitation was issued to a different email address",
      );
    }

    const member = await prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
      });

      let membership = existing;
      if (!membership) {
        membership = await tx.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId,
            role: invitation.role,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return membership;
    });

    return {
      workspace: invitation.workspace,
      member,
    };
  }
}

export const workspaceService = new WorkspaceService();
