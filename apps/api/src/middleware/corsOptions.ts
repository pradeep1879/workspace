import type { CorsOptions } from "cors";

export function createCorsOptions(
  configuredOrigin: string,
  nodeEnv: string,
): CorsOptions {
  const allowedOrigins = new Set([configuredOrigin]);

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      const isLocalDevelopmentOrigin =
        nodeEnv !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      callback(null, isLocalDevelopmentOrigin);
    },
  };
}
