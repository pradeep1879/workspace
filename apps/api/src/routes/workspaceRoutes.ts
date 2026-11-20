import { Router, Request, Response, NextFunction } from "express";
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  createSuccessResponse,
} from "@collab/contracts";
import { workspaceService } from "../services/workspaceService.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

workspaceRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await workspaceService.listWorkspacesForUser(req.user!.id);
      res.status(200).json(createSuccessResponse(list));
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.post(
  "/",
  validate({ body: CreateWorkspaceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await workspaceService.createWorkspace(
        req.body,
        req.user!.id,
      );
      res
        .status(201)
        .json(
          createSuccessResponse(workspace, "Workspace created successfully"),
        );
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.get(
  "/:workspaceId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await workspaceService.getWorkspaceDetail(
        req.params.workspaceId,
        req.user!.id,
      );
      res.status(200).json(createSuccessResponse(detail));
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.patch(
  "/:workspaceId",
  validate({ body: UpdateWorkspaceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await workspaceService.updateWorkspace(
        req.params.workspaceId,
        req.body,
        req.user!.id,
      );
      res
        .status(200)
        .json(createSuccessResponse(updated, "Workspace updated successfully"));
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete(
  "/:workspaceId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await workspaceService.deleteWorkspace(
        req.params.workspaceId,
        req.user!.id,
      );
      res
        .status(200)
        .json(createSuccessResponse(result, "Workspace deleted successfully"));
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.get(
  "/:workspaceId/members",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await workspaceService.listMembers(
        req.params.workspaceId,
        req.user!.id,
      );
      res.status(200).json(createSuccessResponse(members));
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.post(
  "/:workspaceId/invitations",
  validate({ body: InviteMemberSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await workspaceService.createInvitation(
        req.params.workspaceId,
        req.body,
        req.user!.id,
      );
      res
        .status(201)
        .json(createSuccessResponse(result, "Invitation created successfully"));
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.post(
  "/invitations/:token/accept",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await workspaceService.acceptInvitation(
        req.params.token,
        req.user!.id,
      );
      res
        .status(200)
        .json(
          createSuccessResponse(result, "Invitation accepted successfully"),
        );
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.patch(
  "/:workspaceId/members/:memberId",
  validate({ body: UpdateMemberRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await workspaceService.updateMemberRole(
        req.params.workspaceId,
        req.params.memberId,
        req.body,
        req.user!.id,
      );
      res
        .status(200)
        .json(
          createSuccessResponse(updated, "Member role updated successfully"),
        );
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete(
  "/:workspaceId/members/:memberId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await workspaceService.removeMember(
        req.params.workspaceId,
        req.params.memberId,
        req.user!.id,
      );
      res
        .status(200)
        .json(createSuccessResponse(result, "Member removed successfully"));
    } catch (err) {
      next(err);
    }
  },
);
