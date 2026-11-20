import { z } from "zod";

export const ApiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection URL")
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must use the PostgreSQL protocol",
    ),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
});

export const CollaborationEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection URL")
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must use the PostgreSQL protocol",
    ),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  INSTANCE_ID: z.string().default("collab-1"),
  COLLAB_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

export const WebEnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:4000"),
  VITE_COLLAB_WS_URL: z.string().url().default("ws://localhost:4001"),
});

export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  rawEnv: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    const errorMessages = Object.entries(formatted)
      .filter(([k]) => k !== "_errors")
      .map(
        ([k, v]) => `  - ${k}: ${(v as any)?._errors?.join(", ") || "Invalid"}`,
      )
      .join("\n");
    console.error(`\n❌ Environment validation failed:\n${errorMessages}\n`);
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }
  return result.data;
}
