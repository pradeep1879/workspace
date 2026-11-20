import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { prisma } from "@collab/db";
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
} from "@collab/contracts";
import { config } from "./config.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/authRoutes.js";
import { workspaceRouter } from "./routes/workspaceRoutes.js";
import { pageRouter } from "./routes/pageRoutes.js";
import { commentRouter } from "./routes/commentRoutes.js";
import { createCorsOptions } from "./middleware/corsOptions.js";

export const app = express();

app.use(helmet());
app.use(cors(createCorsOptions(config.CORS_ORIGIN, config.NODE_ENV)));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(requestLogger);

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json(
      createSuccessResponse({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
      }),
    );
  } catch {
    res.status(503).json(
      createErrorResponse(ErrorCode.INTERNAL_ERROR, "Service unhealthy", {
        database: "disconnected",
      }),
    );
  }
});

// Mount Routes
app.use("/api/auth", authRouter);
app.use("/api/workspaces", workspaceRouter);
app.use(pageRouter);
app.use(commentRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res
    .status(404)
    .json(
      createErrorResponse(
        ErrorCode.NOT_FOUND,
        `Route not found: ${req.method} ${req.originalUrl}`,
      ),
    );
});

// Centralized Error Handler
app.use(errorHandler);
