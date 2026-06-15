import { describe, it, expect, vi } from "vitest";
import { ConnectionManager } from "./connection-manager.js";
import { FakeClock } from "../clock.js";
import type { PlayerId } from "@masa/shared";

describe("ConnectionManager", () => {
  it("maps a socket to a player and resolves it back", () => {
    const cm = new ConnectionManager(new FakeClock(), 30000, vi.fn());
    cm.attach("sock1", "p1" as PlayerId);
    expect(cm.playerForSocket("sock1")).toBe("p1");
  });

  it("does NOT drop a player who reconnects within the grace period", () => {
    const onExpire = vi.fn();
    const clock = new FakeClock();
    const cm = new ConnectionManager(clock, 30000, onExpire);
    cm.attach("sock1", "p1" as PlayerId);

    cm.handleDisconnect("sock1");
    clock.advance(29999);
    // reconnect with a new socket id under the same player
    cm.attach("sock2", "p1" as PlayerId);
    clock.advance(10000);

    expect(onExpire).not.toHaveBeenCalled();
    expect(cm.playerForSocket("sock2")).toBe("p1");
  });

  it("calls onExpire with the player when the grace period elapses", () => {
    const onExpire = vi.fn();
    const clock = new FakeClock();
    const cm = new ConnectionManager(clock, 30000, onExpire);
    cm.attach("sock1", "p1" as PlayerId);

    cm.handleDisconnect("sock1");
    clock.advance(30000);

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledWith("p1");
  });

  it("treats a player as connected on any active socket", () => {
    const cm = new ConnectionManager(new FakeClock(), 30000, vi.fn());
    cm.attach("sock1", "p1" as PlayerId);
    expect(cm.isConnected("p1" as PlayerId)).toBe(true);
    cm.handleDisconnect("sock1");
    expect(cm.isConnected("p1" as PlayerId)).toBe(false);
  });
});
