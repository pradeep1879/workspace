import { Request, Response, NextFunction } from "express";
import { Logger } from "@collab/contracts";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      logger?: Logger;
    }
  }
}

const apiLogger = new Logger("API");

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const reqId =
    (req.headers["x-request-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  req.id = reqId;
  req.logger = apiLogger.withContext(reqId);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      req.logger?.error(
        `HTTP ${req.method} ${req.originalUrl} failed`,
        undefined,
        meta,
      );
    } else if (res.statusCode >= 400) {
      req.logger?.warn(
        `HTTP ${req.method} ${req.originalUrl} returned client error`,
        meta,
      );
    } else {
      req.logger?.info(`HTTP ${req.method} ${req.originalUrl}`, meta);
    }
  });

  next();
}
