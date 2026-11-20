import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import {
  RegisterInputSchema,
  LoginInputSchema,
  RefreshTokenInputSchema,
  createSuccessResponse,
} from "@collab/contracts";
import { authService } from "../services/authService.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";

export const authRouter = Router();

authRouter.post(
  "/collaboration-token",
  requireAuth,
  (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const token = jwt.sign(
      {
        userId: req.user.id,
        sessionId: req.user.sessionId,
        purpose: "collaboration",
      },
      config.JWT_SECRET,
      { expiresIn: "60s" },
    );

    res.status(200).json(createSuccessResponse({ token }));
  },
);

// Rate limiting for auth endpoints (registration & login) to mitigate brute-force
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message:
        "Too many authentication attempts. Please try again after 15 minutes.",
    },
  },
});

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
): void {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    // The web app and API are hosted on different origins in production.
    // Allow credentialed cross-origin fetches to send the cookie over HTTPS.
    sameSite: isProd ? "none" : "lax",
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/api/auth", // Only sent to auth paths
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}

function clearAuthCookies(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth",
  });
}

authRouter.post(
  "/register",
  authRateLimiter,
  validate({ body: RegisterInputSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res
        .status(201)
        .json(
          createSuccessResponse(
            { user: result.user },
            "Registration successful",
          ),
        );
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate({ body: LoginInputSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      res
        .status(200)
        .json(createSuccessResponse({ user: result.user }, "Login successful"));
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/refresh",
  validate({ body: RefreshTokenInputSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const result = await authService.refresh(refreshToken);
      setAuthCookies(res, result.accessToken);
      res
        .status(200)
        .json(
          createSuccessResponse(
            { user: result.user },
            "Session refreshed successfully",
          ),
        );
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      await authService.logout(refreshToken);
      clearAuthCookies(res);
      res
        .status(200)
        .json(
          createSuccessResponse({ loggedOut: true }, "Logged out successfully"),
        );
    } catch (err) {
      next(err);
    }
  },
);

authRouter.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await authService.getUserProfile(req.user!.id);
      res.status(200).json(createSuccessResponse(profile));
    } catch (err) {
      next(err);
    }
  },
);
