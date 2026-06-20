import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, TableMeld } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

// okey = red 13 → the wildcard tiles are the two red 13s.
const okey: NumberedTile = numbered("red", 13);
const wild = (): OkeyTile => numbered("red", 13);
const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 });

function player(seat: number, hand: OkeyTile[], over: Partial<PlayerHandState> = {}): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false, ...over };
}

function actState(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config, indicator: numbered("red", 12), okey,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null, feedingEvents: [],
    meldSeq: 1, status: "playing", outcome: null, ...over,
  };
}

describe("okey swap", () => {
  it("an opened player swaps the real tile in and takes the okey", () => {
    // run blue 5 - [okey=6] - blue 7; player holds blue 6.
    const meld: TableMeld = { id: "0", owner: 1, kind: "run", tiles: [numbered("blue", 5), wild(), numbered("blue", 7)] };
    const s = actState({
      tableMelds: [meld],
      players: [player(0, [numbered("blue", 6), numbered("black", 2)], { opened: true, openMode: "melds" }), player(1, []), player(2, []), player(3, [])],
    });
    const s2 = applyMove(s, { kind: "swapOkey", meldId: "0", tile: numbered("blue", 6) }, 0);
    expect(s2.tableMelds[0]!.tiles).toEqual([numbered("blue", 5), numbered("blue", 6), numbered("blue", 7)]);
    expect(s2.players[0]!.hand).toContainEqual(wild()); // took the okey
    expect(s2.players[0]!.hand).not.toContainEqual(numbered("blue", 6)); // gave the real tile
  });

  it("rejects when the player has not opened", () => {
    const meld: TableMeld = { id: "0", owner: 1, kind: "run", tiles: [numbered("blue", 5), wild(), numbered("blue", 7)] };
    const s = actState({
      tableMelds: [meld],
      players: [player(0, [numbered("blue", 6)], { opened: false }), player(1, []), player(2, []), player(3, [])],
    });
    expect(() => applyMove(s, { kind: "swapOkey", meldId: "0", tile: numbered("blue", 6) }, 0)).toThrow();
  });

  it("rejects an offered tile that does not match the okey's role", () => {
    const meld: TableMeld = { id: "0", owner: 1, kind: "run", tiles: [numbered("blue", 5), wild(), numbered("blue", 7)] };
    const s = actState({
      tableMelds: [meld],
      players: [player(0, [numbered("blue", 9)], { opened: true, openMode: "melds" })],
    });
    expect(() => applyMove(s, { kind: "swapOkey", meldId: "0", tile: numbered("blue", 9) }, 0)).toThrow();
  });
});
