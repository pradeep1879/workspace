import { describe, it, expect } from "vitest";
import {
  ApiEnvSchema,
  validateEnv,
  sanitizeLogData,
  createSuccessResponse,
  createErrorResponse,
  ErrorCode,
  RegisterInputSchema,
  CreateWorkspaceSchema,
  CreatePageSchema,
} from "../index.js";

describe("Contracts & Foundation Suite", () => {
  describe("Environment Validation", () => {
    it("validates a correct environment configuration", () => {
      const raw = {
        NODE_ENV: "test",
        PORT: "4000",
        DATABASE_URL:
          "postgresql://collab:collab_secret@localhost:5432/collab_db",
        JWT_SECRET: "this_is_a_super_secret_jwt_key_at_least_16_chars",
        REDIS_URL: "redis://localhost:6379",
      };
      const parsed = validateEnv(ApiEnvSchema, raw);
      expect(parsed.NODE_ENV).toBe("test");
      expect(parsed.PORT).toBe(4000);
      expect(parsed.DATABASE_URL).toContain("postgresql://");
    });

    it("fails fast on missing or invalid configuration", () => {
      const raw = {
        NODE_ENV: "invalid_env",
        DATABASE_URL: "not-a-url",
        JWT_SECRET: "short",
      };
      expect(() => validateEnv(ApiEnvSchema, raw as any)).toThrowError(
        /Environment validation failed/,
      );
    });
  });

  describe("Logger Redaction", () => {
    it("redacts sensitive credentials and retains safe data", () => {
      const sensitiveData = {
        user: "alice",
        password: "superSecretPassword123!",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        authorization: "Bearer secret_token_xyz",
        cookie: "session_id=12345",
        pageId: "page_123",
        nested: {
          refreshToken: "refresh_token_abc",
          documentState: new Uint8Array([1, 2, 3]),
        },
      };

      const sanitized: any = sanitizeLogData(sensitiveData);
      expect(sanitized.user).toBe("alice");
      expect(sanitized.pageId).toBe("page_123");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.cookie).toBe("[REDACTED]");
      expect(sanitized.nested.refreshToken).toBe("[REDACTED]");
    });
  });

  describe("Standard API Responses", () => {
    it("creates standard success response", () => {
      const res = createSuccessResponse({ id: "123" }, "Created successfully");
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ id: "123" });
      expect(res.message).toBe("Created successfully");
    });

    it("creates standard error response", () => {
      const res = createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        "Invalid credentials",
      );
      expect(res.success).toBe(false);
      expect(res.error.code).toBe("UNAUTHORIZED");
      expect(res.error.message).toBe("Invalid credentials");
    });
  });

  describe("Input Schemas", () => {
    it("validates registration input correctly", () => {
      const valid = {
        email: "User@Example.COM",
        password: "securePassword123",
        name: "Alice Cooper",
      };
      const parsed = RegisterInputSchema.parse(valid);
      expect(parsed.email).toBe("user@example.com"); // lowercased
      expect(parsed.name).toBe("Alice Cooper");

      expect(() =>
        RegisterInputSchema.parse({
          email: "bad-email",
          password: "123",
          name: "",
        }),
      ).toThrow();
    });

    it("validates workspace creation", () => {
      expect(CreateWorkspaceSchema.parse({ name: "Acme Corp" })).toEqual({
        name: "Acme Corp",
      });
      expect(() => CreateWorkspaceSchema.parse({ name: "" })).toThrow();
    });

    it("validates page creation with defaults", () => {
      const res = CreatePageSchema.parse({});
      expect(res.title).toBe("Untitled");
    });
  });
});
