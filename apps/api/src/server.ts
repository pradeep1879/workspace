import { app } from "./app.js";
import { config } from "./config.js";
import { Logger } from "@collab/contracts";

const logger = new Logger("Server");

const server = app.listen(config.PORT, () => {
  logger.info(
    `REST API Server listening on port ${config.PORT} [${config.NODE_ENV}]`,
  );
});

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
