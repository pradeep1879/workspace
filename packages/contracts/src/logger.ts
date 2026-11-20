export type LogLevel = "debug" | "info" | "warn" | "error";

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "jwt_secret",
  "state",
  "update",
  "content",
]);

function redactValue(key: string, val: unknown): unknown {
  if (val === null || val === undefined) return val;
  const lowerKey = key.toLowerCase();
  if (REDACTED_KEYS.has(lowerKey)) {
    return "[REDACTED]";
  }
  if (typeof val === "object") {
    return sanitizeLogData(val);
  }
  return val;
}

export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }
  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      sanitized[k] = redactValue(k, v);
    }
    return sanitized;
  }
  return data;
}

export class Logger {
  constructor(private context: string = "App") {}

  private formatMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? sanitizeLogData(meta) : undefined;
    const metaStr = cleanMeta ? ` ${JSON.stringify(cleanMeta)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test"
    ) {
      console.debug(this.formatMessage("debug", message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatMessage("info", message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage("warn", message, meta));
  }

  error(
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const errorDetails: Record<string, unknown> = { ...(meta || {}) };
    if (error instanceof Error) {
      errorDetails.errorMessage = error.message;
      errorDetails.stack = error.stack;
    } else if (error !== undefined) {
      errorDetails.error = error;
    }
    console.error(this.formatMessage("error", message, errorDetails));
  }

  withContext(newContext: string): Logger {
    return new Logger(`${this.context}:${newContext}`);
  }
}

export const defaultLogger = new Logger("Collab");
