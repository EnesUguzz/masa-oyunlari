import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";
import { isNumbered } from "./tile.js";

const config = makeConfig({ pairing: "esli", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"] as PlayerId[];

describe("createHand", () => {
  it("deals 22/21/21/21, a numbered indicator, 20 draw pile", () => {
    const s = createHand(config, players, new SeededRng(1));
    expect(s.players.map((p) => p.hand.length)).toEqual([22, 21, 21, 21]);
    expect(isNumbered(s.indicator)).toBe(true);
    expect(s.drawPile.length).toBe(20);
    expect(s.okey.value).toBe(s.indicator.value === 13 ? 1 : s.indicator.value + 1);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("act");
    expect(s.status).toBe("playing");
  });

  it("the starting player holds 22 tiles and must act (cannot draw first)", () => {
    const s = createHand(config, players, new SeededRng(1));
    expect(s.players[0]!.hand.length).toBe(22);
    expect(() => applyMove(s, { kind: "drawFromPile" }, 0)).toThrow();
    expect(() => applyMove(s, { kind: "drawFromDiscard" }, 0)).toThrow();
    // discarding one of its tiles is allowed and hands the turn to seat 1 in draw phase
    const after = applyMove(s, { kind: "discard", tile: s.players[0]!.hand[0]! }, 0);
    expect(after.turn).toBe(1);
    expect(after.phase).toBe("draw");
    expect(after.players[0]!.hand.length).toBe(21);
  });

  it("assigns facing teams in esli (0&2 vs 1&3), null in essiz", () => {
    const s = createHand(config, players, new SeededRng(2));
    expect(s.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
    const solo = createHand(makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }), players, new SeededRng(2));
    expect(solo.players.every((p) => p.team === null)).toBe(true);
  });

  it("conserves all 106 tiles and is deterministic per seed", () => {
    const s1 = createHand(config, players, new SeededRng(7));
    const s2 = createHand(config, players, new SeededRng(7));
    const count = s1.players.reduce((n, p) => n + p.hand.length, 0) + s1.drawPile.length + 1;
    expect(count).toBe(106);
    expect(JSON.stringify(s1.players[0]!.hand)).toBe(JSON.stringify(s2.players[0]!.hand));
  });

  it("rejects a player list that is not exactly 4", () => {
    expect(() => createHand(config, ["a", "b", "c"] as PlayerId[], new SeededRng(1))).toThrow();
  });
});
