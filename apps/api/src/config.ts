import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ApiEnvSchema, validateEnv } from "@collab/contracts";

// Load .env from root if not already set
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = validateEnv(ApiEnvSchema, {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.API_PORT || process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  REDIS_URL: process.env.REDIS_URL,
});
