import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createErrorResponse, ErrorCode } from "@collab/contracts";

type RequestValidationSchema = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

export function validate(schema: RequestValidationSchema) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as any;
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json(
          createErrorResponse(ErrorCode.BAD_REQUEST, "Validation error", {
            errors: err.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          }),
        );
        return;
      }
      next(err);
    }
  };
}
