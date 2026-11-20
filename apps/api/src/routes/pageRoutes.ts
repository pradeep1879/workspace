import { NextFunction, Request, Response, Router } from "express";
import {
  CreatePageSchema,
  MovePageSchema,
  SetPagePermissionSchema,
  UpdatePageSchema,
  createSuccessResponse,
} from "@collab/contracts";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { pageService } from "../services/pageService.js";

export const pageRouter = Router();
pageRouter.use(requireAuth);

const respond =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };

pageRouter.get(
  "/api/workspaces/:workspaceId/pages",
  respond(async (req, res) => {
    const tree = await pageService.listTree(
      req.params.workspaceId,
      req.user!.id,
    );
    res.status(200).json(createSuccessResponse(tree));
  }),
);

pageRouter.post(
  "/api/workspaces/:workspaceId/pages",
  validate({ body: CreatePageSchema }),
  respond(async (req, res) => {
    const page = await pageService.create(
      req.params.workspaceId,
      req.user!.id,
      req.body,
    );
    res
      .status(201)
      .json(createSuccessResponse(page, "Page created successfully"));
  }),
);

pageRouter.get(
  "/api/pages/:pageId",
  respond(async (req, res) => {
    const page = await pageService.get(req.params.pageId, req.user!.id);
    res.status(200).json(createSuccessResponse(page));
  }),
);

pageRouter.patch(
  "/api/pages/:pageId",
  validate({ body: UpdatePageSchema }),
  respond(async (req, res) => {
    const page = await pageService.update(
      req.params.pageId,
      req.user!.id,
      req.body,
    );
    res
      .status(200)
      .json(createSuccessResponse(page, "Page updated successfully"));
  }),
);

pageRouter.post(
  "/api/pages/:pageId/move",
  validate({ body: MovePageSchema }),
  respond(async (req, res) => {
    const page = await pageService.move(
      req.params.pageId,
      req.user!.id,
      req.body,
    );
    res
      .status(200)
      .json(createSuccessResponse(page, "Page moved successfully"));
  }),
);

pageRouter.delete(
  "/api/pages/:pageId",
  respond(async (req, res) => {
    const result = await pageService.remove(req.params.pageId, req.user!.id);
    res
      .status(200)
      .json(createSuccessResponse(result, "Page deleted successfully"));
  }),
);

pageRouter.get(
  "/api/pages/:pageId/permissions",
  respond(async (req, res) => {
    const result = await pageService.listPermissions(
      req.params.pageId,
      req.user!.id,
    );
    res.status(200).json(createSuccessResponse(result));
  }),
);

pageRouter.put(
  "/api/pages/:pageId/permissions",
  validate({ body: SetPagePermissionSchema }),
  respond(async (req, res) => {
    const result = await pageService.setPermission(
      req.params.pageId,
      req.user!.id,
      req.body,
    );
    res
      .status(200)
      .json(
        createSuccessResponse(result, "Page permission updated successfully"),
      );
  }),
);
