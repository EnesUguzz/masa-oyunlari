import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyColor } from "./tile.js";
import type { OkeyGameState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

function stateWithHand(hand: NumberedTile[], opts?: { opened?: boolean }): OkeyGameState {
  const okey: NumberedTile = numbered("red", 13);
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
    indicator: numbered("red", 12),
    okey,
    players: [
      {
        seat: 0, playerId: "p0" as PlayerId, team: null, hand: [...hand],
        opened: opts?.opened ?? false, openMode: opts?.opened ? "melds" : null,
        openScore: opts?.opened ? 101 : 0, pairCount: 0, openedOnTurn: opts?.opened ? 0 : null,
        floorPenalty: false,
      },
      { seat: 1, playerId: "p1" as PlayerId, team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false },
      { seat: 2, playerId: "p2" as PlayerId, team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false },
      { seat: 3, playerId: "p3" as PlayerId, team: null, hand: [], opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false },
    ],
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: opts?.opened ? 101 : null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

function run(color: OkeyColor, from: number, to: number): NumberedTile[] {
  const t: NumberedTile[] = [];
  for (let v = from; v <= to; v++) t.push(numbered(color, v));
  return t;
}

describe("autoOpen", () => {
  it("opens the best melds when the hand reaches the threshold, leaving junk in hand", () => {
    const melds = [run("black", 10, 13), run("blue", 10, 13), [numbered("red", 5), numbered("yellow", 5), numbered("black", 5)]];
    const junk = [numbered("blue", 1), numbered("yellow", 2)];
    const s = stateWithHand([...melds.flat(), ...junk]);
    const next = applyMove(s, { kind: "autoOpen" }, 0);
    expect(next.players[0]!.opened).toBe(true);
    expect(next.players[0]!.openMode).toBe("melds");
    expect(next.players[0]!.openScore).toBe(107);
    expect(next.tableMelds.length).toBe(3);
    expect(next.players[0]!.hand.length).toBe(2); // junk stays for the player to discard/keep
  });

  it("rejects autoOpen when the hand cannot reach the threshold", () => {
    const s = stateWithHand([...run("black", 1, 3), numbered("blue", 9), numbered("yellow", 7)]);
    expect(() => applyMove(s, { kind: "autoOpen" }, 0)).toThrow();
  });

  it("lays all further melds when already opened, keeping at least one tile to discard", () => {
    const s = stateWithHand([...run("blue", 1, 3), numbered("red", 7)], { opened: true });
    const next = applyMove(s, { kind: "autoOpen" }, 0);
    expect(next.tableMelds.length).toBe(1); // the new blue 1-2-3 run
    expect(next.players[0]!.hand.length).toBe(1); // red 7 remains
  });
});
