import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("CORS development origins", () => {
  it.each([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:4173",
  ])("allows local origin %s with credentials", async (origin) => {
    const response = await request(app)
      .options("/api/auth/register")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not allow arbitrary origins", async () => {
    const response = await request(app)
      .options("/api/auth/register")
      .set("Origin", "https://untrusted.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
