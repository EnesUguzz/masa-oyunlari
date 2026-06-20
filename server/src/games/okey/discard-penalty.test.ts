import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, TableMeld } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13); // the wildcard for these tests

function player(seat: number, hand: OkeyTile[], over: Partial<PlayerHandState> = {}): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false, ...over };
}

function actState(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey,
    drawPile: [numbered("black", 1)], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null, feedingEvents: [],
    meldSeq: 9, status: "playing", outcome: null, ...over,
  };
}

const yellowRun: TableMeld = {
  id: "m", owner: 1, kind: "run",
  tiles: [numbered("yellow", 9), numbered("yellow", 10), numbered("yellow", 11)],
};

describe("işlek/okey atma cezası (discard penalty)", () => {
  it("penalizes discarding a tile that extends an existing run (+101), even unopened", () => {
    const s = actState({
      tableMelds: [yellowRun],
      players: [player(0, [numbered("yellow", 8), numbered("black", 2)]), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("yellow", 8) }, 0);
    expect(next.players[0]!.discardPenalty).toBe(101);
  });

  it("penalizes a tile that extends a set on the other end too (yellow 12)", () => {
    const s = actState({
      tableMelds: [yellowRun],
      players: [player(0, [numbered("yellow", 12), numbered("black", 2)]), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("yellow", 12) }, 0);
    expect(next.players[0]!.discardPenalty).toBe(101);
  });

  it("does not penalize discarding a non-processable tile", () => {
    const s = actState({
      tableMelds: [yellowRun],
      players: [player(0, [numbered("black", 2), numbered("black", 3)]), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("black", 2) }, 0);
    expect(next.players[0]!.discardPenalty ?? 0).toBe(0);
  });

  it("never penalizes processing onto a pair (pairs cannot be processed)", () => {
    const pair: TableMeld = { id: "p", owner: 1, kind: "pair", tiles: [numbered("yellow", 8), numbered("yellow", 8)] };
    const s = actState({
      tableMelds: [pair],
      players: [player(0, [numbered("yellow", 8), numbered("black", 2)]), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("yellow", 8) }, 0);
    expect(next.players[0]!.discardPenalty ?? 0).toBe(0);
  });

  it("penalizes discarding the okey (wildcard) even with no table melds (+101)", () => {
    const s = actState({
      tableMelds: [],
      players: [player(0, [numbered("red", 13), numbered("black", 2)]), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("red", 13) }, 0);
    expect(next.players[0]!.discardPenalty).toBe(101);
  });

  it("exempts the finishing discard even when it is processable (last tile)", () => {
    const s = actState({
      tableMelds: [yellowRun],
      players: [player(0, [numbered("yellow", 8)], { opened: true, openMode: "melds" }), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("yellow", 8) }, 0);
    expect(next.status).toBe("finished");
    expect(next.players[0]!.discardPenalty ?? 0).toBe(0);
  });
});
