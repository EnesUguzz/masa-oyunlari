import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses defaults when env vars are absent", () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(3001);
    expect(cfg.gracePeriodMs).toBe(30000);
    expect(cfg.turnTimeoutMs).toBe(60000);
    expect(cfg.clientOrigin).toBe("http://localhost:5173");
  });

  it("reads overrides from the provided env object", () => {
    const cfg = loadConfig({
      PORT: "4000",
      GRACE_PERIOD_MS: "5000",
      TURN_TIMEOUT_MS: "10000",
      CLIENT_ORIGIN: "https://example.com",
    });
    expect(cfg.port).toBe(4000);
    expect(cfg.gracePeriodMs).toBe(5000);
    expect(cfg.turnTimeoutMs).toBe(10000);
    expect(cfg.clientOrigin).toBe("https://example.com");
  });

  it("throws on a non-numeric PORT", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
  });
});
