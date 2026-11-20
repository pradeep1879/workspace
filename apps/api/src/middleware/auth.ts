import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorCode } from "@collab/contracts";
import { prisma } from "@collab/db";
import { config } from "../config.js";
import { AppError } from "./errorHandler.js";
import { TokenPayload } from "../services/authService.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  sessionId: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
}

async function getActiveTokenUser(token: string): Promise<AuthenticatedUser> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  } catch {
    throw new AppError(
      401,
      ErrorCode.UNAUTHORIZED,
      "Invalid or expired authentication token",
    );
  }
  if (
    !payload.userId ||
    !payload.sessionId ||
    !payload.email ||
    !payload.name
  ) {
    throw new AppError(
      401,
      ErrorCode.UNAUTHORIZED,
      "Invalid or expired authentication token",
    );
  }
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });
  if (
    !session ||
    session.userId !== payload.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  ) {
    throw new AppError(
      401,
      ErrorCode.UNAUTHORIZED,
      "Session has expired or been revoked",
    );
  }
  return {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
    sessionId: payload.sessionId,
  };
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    next(
      new AppError(
        401,
        ErrorCode.UNAUTHORIZED,
        "Authentication token required",
      ),
    );
    return;
  }

  void getActiveTokenUser(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  void getActiveTokenUser(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 401) return next();
      next(error);
    });
}
