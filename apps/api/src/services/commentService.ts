import { WorkspaceRole, prisma } from "@collab/db";
import {
  CreateCommentInput,
  ErrorCode,
  ReplyCommentInput,
  UpdateCommentInput,
} from "@collab/contracts";
import { AppError } from "../middleware/errorHandler.js";
import { pageService } from "./pageService.js";

const authorSelect = { id: true, name: true, avatarUrl: true } as const;

export class CommentService {
  async list(pageId: string, userId: string) {
    await pageService.requirePermission(pageId, userId, "VIEW");
    const comments = await prisma.comment.findMany({
      where: { pageId },
      include: {
        author: { select: authorSelect },
        replies: {
          include: { author: { select: authorSelect } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return comments.map(({ anchorFrom, anchorTo, anchorText, ...comment }) => ({
      ...comment,
      anchor:
        anchorFrom === null || anchorTo === null
          ? null
          : {
              from: anchorFrom,
              to: anchorTo,
              ...(anchorText === null ? {} : { text: anchorText }),
            },
    }));
  }

  async create(pageId: string, userId: string, input: CreateCommentInput) {
    await pageService.requirePermission(pageId, userId, "COMMENT");
    const comment = await prisma.comment.create({
      data: {
        pageId,
        authorId: userId,
        content: input.content,
        anchorFrom: input.anchor?.from,
        anchorTo: input.anchor?.to,
        anchorText: input.anchor?.text,
      },
      include: {
        author: { select: authorSelect },
        replies: { include: { author: { select: authorSelect } } },
      },
    });
    const { anchorFrom, anchorTo, anchorText, ...result } = comment;
    return {
      ...result,
      anchor:
        anchorFrom === null || anchorTo === null
          ? null
          : {
              from: anchorFrom,
              to: anchorTo,
              ...(anchorText === null ? {} : { text: anchorText }),
            },
    };
  }

  async reply(commentId: string, userId: string, input: ReplyCommentInput) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { pageId: true },
    });
    if (!comment)
      throw new AppError(404, ErrorCode.NOT_FOUND, "Comment not found");
    await pageService.requirePermission(comment.pageId, userId, "COMMENT");
    return prisma.commentReply.create({
      data: { commentId, authorId: userId, content: input.content },
      include: { author: { select: authorSelect } },
    });
  }

  private async authorizeManage(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { page: { select: { workspaceId: true } } },
    });
    if (!comment)
      throw new AppError(404, ErrorCode.NOT_FOUND, "Comment not found");
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: comment.page.workspaceId, userId },
      },
      select: { role: true },
    });
    if (!member)
      throw new AppError(404, ErrorCode.NOT_FOUND, "Comment not found");
    const isManager =
      member.role === WorkspaceRole.OWNER ||
      member.role === WorkspaceRole.ADMIN;
    if (comment.authorId !== userId && !isManager) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Only the comment author or a workspace administrator can manage this comment",
      );
    }
    return comment;
  }

  async update(commentId: string, userId: string, input: UpdateCommentInput) {
    const comment = await this.authorizeManage(commentId, userId);
    if (input.content !== undefined && comment.authorId !== userId) {
      throw new AppError(
        403,
        ErrorCode.FORBIDDEN,
        "Only the comment author can edit its content",
      );
    }
    return prisma.comment.update({ where: { id: commentId }, data: input });
  }

  async delete(commentId: string, userId: string) {
    await this.authorizeManage(commentId, userId);
    await prisma.comment.delete({ where: { id: commentId } });
    return { id: commentId, deleted: true };
  }
}

export const commentService = new CommentService();
