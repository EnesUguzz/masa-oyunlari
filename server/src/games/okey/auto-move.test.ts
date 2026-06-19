import { describe, expect, it } from "vitest";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import type { PlayerId } from "@masa/shared";
import { makeConfig } from "./game-config.js";
import { autoMoves } from "./auto-move.js";

const okey: NumberedTile = numbered("red", 13);
function p(seat: number, hand: OkeyTile[]): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false };
}
function st(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey, drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "draw", pendingFloorTile: null, highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null, ...over,
  };
}

describe("autoMoves", () => {
  it("draws from the pile in the draw phase", () => {
    const s = st({ players: [p(0, [numbered("blue", 4)]), p(1, []), p(2, []), p(3, [])], phase: "draw" });
    expect(autoMoves(s)).toEqual([{ kind: "drawFromPile" }]);
  });
  it("discards the last hand tile in the act phase", () => {
    const tile = numbered("blue", 7);
    const s = st({ players: [p(0, [numbered("blue", 4), tile]), p(1, []), p(2, []), p(3, [])], phase: "act" });
    expect(autoMoves(s)).toEqual([{ kind: "discard", tile }]);
  });
  it("returns nothing in the act phase while a floor tile is pending", () => {
    const s = st({ players: [p(0, [numbered("blue", 4)]), p(1, []), p(2, []), p(3, [])], phase: "act", pendingFloorTile: numbered("blue", 4) });
    expect(autoMoves(s)).toEqual([]);
  });
});
