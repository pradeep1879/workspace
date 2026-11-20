import { NextFunction, Request, Response, Router } from "express";
import {
  CreateCommentSchema,
  ReplyCommentSchema,
  UpdateCommentSchema,
  createSuccessResponse,
} from "@collab/contracts";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { commentService } from "../services/commentService.js";

export const commentRouter = Router();
commentRouter.use(requireAuth);

const respond =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };

commentRouter.get(
  "/api/pages/:pageId/comments",
  respond(async (req, res) => {
    const comments = await commentService.list(req.params.pageId, req.user!.id);
    res.status(200).json(createSuccessResponse(comments));
  }),
);

commentRouter.post(
  "/api/pages/:pageId/comments",
  validate({ body: CreateCommentSchema }),
  respond(async (req, res) => {
    const comment = await commentService.create(
      req.params.pageId,
      req.user!.id,
      req.body,
    );
    res.status(201).json(createSuccessResponse(comment, "Comment added"));
  }),
);

commentRouter.post(
  "/api/comments/:commentId/replies",
  validate({ body: ReplyCommentSchema }),
  respond(async (req, res) => {
    const reply = await commentService.reply(
      req.params.commentId,
      req.user!.id,
      req.body,
    );
    res.status(201).json(createSuccessResponse(reply, "Reply added"));
  }),
);

commentRouter.patch(
  "/api/comments/:commentId",
  validate({ body: UpdateCommentSchema }),
  respond(async (req, res) => {
    const comment = await commentService.update(
      req.params.commentId,
      req.user!.id,
      req.body,
    );
    res.status(200).json(createSuccessResponse(comment, "Comment updated"));
  }),
);

commentRouter.delete(
  "/api/comments/:commentId",
  respond(async (req, res) => {
    const result = await commentService.delete(
      req.params.commentId,
      req.user!.id,
    );
    res.status(200).json(createSuccessResponse(result, "Comment deleted"));
  }),
);
