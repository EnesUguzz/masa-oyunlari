import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyColor } from "./tile.js";
import type { OkeyGameState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

function stateWithHand(hand: NumberedTile[], opts?: { escalation?: "katlamasiz" | "katlamali"; highestOpenScore?: number | null }): OkeyGameState {
  const okey: NumberedTile = numbered("red", 13);
  return {
    config: makeConfig({ pairing: "essiz", escalation: opts?.escalation ?? "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12),
    okey,
    players: [
      { seat: 0, playerId: "p0" as PlayerId, team: null, hand: [...hand], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
      { seat: 1, playerId: "p1" as PlayerId, team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
      { seat: 2, playerId: "p2" as PlayerId, team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
      { seat: 3, playerId: "p3" as PlayerId, team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null },
    ],
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: opts?.highestOpenScore ?? null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

function run(color: OkeyColor, from: number, to: number): NumberedTile[] {
  const t: NumberedTile[] = [];
  for (let v = from; v <= to; v++) t.push(numbered(color, v));
  return t;
}

describe("openMelds", () => {
  it("accepts an opening that reaches 101 (katlamasiz)", () => {
    const melds = [run("black", 10, 13), run("blue", 10, 13), [numbered("red", 5), numbered("yellow", 5), numbered("black", 5)]];
    const s = stateWithHand(melds.flat());
    const next = applyMove(s, { kind: "openMelds", melds }, 0);
    expect(next.players[0]!.opened).toBe(true);
    expect(next.players[0]!.openMode).toBe("melds");
    expect(next.players[0]!.openScore).toBe(107);
    expect(next.tableMelds.length).toBe(3);
    expect(next.highestOpenScore).toBe(107);
    expect(next.players[0]!.hand.length).toBe(0);
  });

  it("rejects an opening below the threshold", () => {
    const melds = [run("black", 1, 3)];
    const s = stateWithHand(melds.flat());
    expect(() => applyMove(s, { kind: "openMelds", melds }, 0)).toThrow();
  });

  it("katlamali: a later opener must beat the previous opener's score", () => {
    const melds = [run("black", 10, 13), run("blue", 10, 13)]; // 92
    const s = stateWithHand(melds.flat(), { escalation: "katlamali", highestOpenScore: 120 });
    expect(() => applyMove(s, { kind: "openMelds", melds }, 0)).toThrow();
  });

  it("rejects opening when already opened", () => {
    const melds = [run("black", 10, 13), run("blue", 10, 13), [numbered("red", 5), numbered("yellow", 5), numbered("black", 5)]];
    const s = stateWithHand(melds.flat());
    s.players[0]!.opened = true;
    s.players[0]!.openMode = "melds";
    expect(() => applyMove(s, { kind: "openMelds", melds }, 0)).toThrow();
  });
});
