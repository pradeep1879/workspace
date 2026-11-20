import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import {
  Hocuspocus,
  type Connection,
  type Extension,
} from "@hocuspocus/server";
import { Redis as RedisExtension } from "@hocuspocus/extension-redis";
import { CollaborationEnvSchema, Logger, validateEnv } from "@collab/contracts";
import { PagePermissionLevel, WorkspaceRole, prisma } from "@collab/db";
import * as Y from "yjs";
import type { IncomingMessage, ServerResponse } from "node:http";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../../.env") });

const config = validateEnv(CollaborationEnvSchema, {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.COLLAB_PORT || process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  INSTANCE_ID: process.env.COLLAB_INSTANCE_ID,
  COLLAB_ALLOWED_ORIGINS: process.env.COLLAB_ALLOWED_ORIGINS,
});

type SessionContext = {
  userId: string;
  sessionId: string;
  pageId: string;
  permission: "VIEW" | "COMMENT" | "EDIT";
  lastCheckedAt: number;
};

const AUTHORIZATION_REFRESH_INTERVAL_MS = 5000;
const logger = new Logger(`Collaboration:${config.INSTANCE_ID}`);
const allowedOrigins = new Set(
  config.COLLAB_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  if (config.NODE_ENV === "production") return false;

  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

const redis = new RedisExtension({
  identifier: config.INSTANCE_ID,
  prefix: "collab",
  lockTimeout: 5000,
  createClient: () => new Redis(config.REDIS_URL),
});

function permissionValue(
  value?: PagePermissionLevel,
): SessionContext["permission"] {
  return value ?? "EDIT";
}

async function findSessionPermission(
  userId: string,
  sessionId: string,
  pageId: string,
): Promise<SessionContext["permission"] | null> {
  const [session, page] = await Promise.all([
    prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true },
    }),
    prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true, isArchived: true },
    }),
  ]);
  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  )
    return null;

  if (!page || page.isArchived) return null;
  const [membership, override] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: page.workspaceId, userId } },
      select: { role: true },
    }),
    prisma.pagePermission.findUnique({
      where: { pageId_userId: { pageId, userId } },
      select: { permission: true },
    }),
  ]);
  if (!membership) return null;
  if (
    membership.role === WorkspaceRole.OWNER ||
    membership.role === WorkspaceRole.ADMIN
  )
    return "EDIT";

  return permissionValue(override?.permission);
}

async function refreshConnectionAuthorization(
  context: SessionContext,
  connection?: Connection,
) {
  if (Date.now() - context.lastCheckedAt < AUTHORIZATION_REFRESH_INTERVAL_MS) {
    return;
  }
  const permission = await findSessionPermission(
    context.userId,
    context.sessionId,
    context.pageId,
  );
  if (!permission) {
    connection?.close();
    throw new Error("Collaboration access has been revoked");
  }
  context.permission = permission;
  context.lastCheckedAt = Date.now();
  if (connection) connection.readOnly = permission !== "EDIT";
}

const persistenceExtension: Extension = {
  priority: 0,
  async onLoadDocument({ document, documentName, context }) {
    if ((context as SessionContext).pageId !== documentName)
      throw new Error("Invalid collaboration document");
    const saved = await prisma.documentState.findUnique({
      where: { pageId: documentName },
      select: { state: true },
    });
    if (saved) Y.applyUpdate(document, new Uint8Array(saved.state));
  },
  async onStoreDocument({ document, documentName, context }) {
    if ((context as SessionContext).pageId !== documentName)
      throw new Error("Invalid collaboration document");
    const encoded = Buffer.from(Y.encodeStateAsUpdate(document));
    const saved = await prisma.documentState.upsert({
      where: { pageId: documentName },
      create: { pageId: documentName, state: encoded, version: 1 },
      update: { state: encoded, version: { increment: 1 } },
      select: { version: true },
    });
    document.broadcastStateless(
      JSON.stringify({ type: "persisted", version: saved.version }),
    );
  },
};

const authorizationExtension: Extension = {
  async onAuthenticate({
    context: _context,
    documentName,
    request,
    connection,
    token,
  }) {
    if (!documentName || documentName.length > 128)
      throw new Error("Invalid collaboration document");
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin))
      throw new Error("WebSocket origin is not allowed");

    let claims: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, config.JWT_SECRET);
      if (typeof verified === "string") throw new Error("Invalid token");
      claims = verified;
    } catch {
      throw new Error("Authentication token required or expired");
    }
    const userId = typeof claims.userId === "string" ? claims.userId : "";
    const sessionId =
      typeof claims.sessionId === "string" ? claims.sessionId : "";
    if (!userId || !sessionId || claims.purpose !== "collaboration")
      throw new Error("A valid collaboration token is required");

    const permission = await findSessionPermission(
      userId,
      sessionId,
      documentName,
    );
    if (!permission) throw new Error("Page access denied");
    connection.readOnly = permission !== "EDIT";
    return {
      userId,
      sessionId,
      pageId: documentName,
      permission,
      lastCheckedAt: Date.now(),
    } satisfies SessionContext;
  },
};

const hocuspocus = new Hocuspocus({
  name: `collaboration-${config.INSTANCE_ID}`,
  port: config.PORT,
  address: "0.0.0.0",
  quiet: config.NODE_ENV === "production",
  debounce: 1000,
  maxDebounce: 5000,
  unloadImmediately: true,
  extensions: [redis, persistenceExtension, authorizationExtension],
  async onRequest({
    request,
    response,
  }: {
    request: IncomingMessage;
    response: ServerResponse;
  }) {
    if (request.url !== "/health") return;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: "healthy",
        instance: config.INSTANCE_ID,
      }),
    );
    // Hocuspocus writes a default response after onRequest hooks finish.
    // Stop its request chain after sending our health response.
    throw null;
  },
});

const revocationMonitor = setInterval(async () => {
  for (const document of hocuspocus.documents.values()) {
    for (const connection of document.getConnections() as Connection[]) {
      try {
        const context = connection.context as SessionContext;
        if (context?.userId && Date.now() - context.lastCheckedAt >= 5000) {
          await refreshConnectionAuthorization(context, connection);
        }
      } catch (error) {
        logger.warn(
          "Closed collaboration connection after authorization check",
          {
            reason:
              error instanceof Error ? error.message : "authorization failed",
          },
        );
      }
    }
  }
}, AUTHORIZATION_REFRESH_INTERVAL_MS);
revocationMonitor.unref();

await hocuspocus.listen();
logger.info(`Hocuspocus server listening on port ${config.PORT}`);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(revocationMonitor);
  logger.info(`Received ${signal}; flushing collaboration documents`);
  await hocuspocus.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
