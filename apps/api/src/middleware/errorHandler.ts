import { Request, Response, NextFunction } from "express";
import { createErrorResponse, ErrorCode } from "@collab/contracts";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  if (err instanceof AppError) {
    req.logger?.warn(`Handled application error: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
    });
    res
      .status(err.statusCode)
      .json(createErrorResponse(err.code, err.message, err.details));
    return;
  }

  req.logger?.error("Unhandled internal server error", err);
  res
    .status(500)
    .json(
      createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        process.env.NODE_ENV === "production"
          ? "An unexpected internal error occurred"
          : err instanceof Error
            ? err.message
            : "Internal Server Error",
      ),
    );
}
