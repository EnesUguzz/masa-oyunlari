import { describe, it, expect } from "vitest";
import { PlayerRegistry } from "./player-registry.js";
import { SeededRng } from "../rng.js";

describe("PlayerRegistry", () => {
  it("creates a new player with a token when no token is provided", () => {
    const reg = new PlayerRegistry(new SeededRng(1));
    const { player, token } = reg.identify({ nickname: "Ada" });
    expect(player.nickname).toBe("Ada");
    expect(player.id).toBeTruthy();
    expect(token).toBeTruthy();
  });

  it("resolves the same player when the same token is presented again", () => {
    const reg = new PlayerRegistry(new SeededRng(1));
    const first = reg.identify({ nickname: "Ada" });
    const second = reg.identify({ token: first.token, nickname: "Ada (renamed)" });
    expect(second.player.id).toBe(first.player.id);
    expect(second.token).toBe(first.token);
    expect(second.player.nickname).toBe("Ada (renamed)");
  });

  it("creates a fresh player when an unknown token is presented", () => {
    const reg = new PlayerRegistry(new SeededRng(1));
    const known = reg.identify({ nickname: "Ada" });
    const result = reg.identify({ token: "not-a-real-token", nickname: "Grace" });
    expect(result.player.id).not.toBe(known.player.id);
  });

  it("generates distinct ids/tokens for distinct players", () => {
    const reg = new PlayerRegistry(new SeededRng(7));
    const a = reg.identify({ nickname: "A" });
    const b = reg.identify({ nickname: "B" });
    expect(a.player.id).not.toBe(b.player.id);
    expect(a.token).not.toBe(b.token);
  });
});
