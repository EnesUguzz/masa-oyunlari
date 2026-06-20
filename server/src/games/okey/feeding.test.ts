import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);
const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 });

function player(seat: number, hand: OkeyTile[], over: Partial<PlayerHandState> = {}): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false, ...over };
}

function state(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config, indicator: numbered("red", 12), okey,
    drawPile: [numbered("black", 1)], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "draw", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null, feedingEvents: [],
    meldSeq: 1, status: "playing", outcome: null, ...over,
  };
}

describe("pairs floor draw & feeding exception", () => {
  it("a pairs opener may take from the floor (previously blocked)", () => {
    const s = state({
      discards: [[], [], [], [numbered("red", 5)]], // prev seat (3) discarded
      players: [player(0, [], { opened: true, openMode: "pairs" }), player(1, []), player(2, []), player(3, [])],
    });
    const s2 = applyMove(s, { kind: "drawFromDiscard" }, 0);
    expect(s2.pendingFloorTile).toEqual(numbered("red", 5));
    expect(s2.players[0]!.hand).toContainEqual(numbered("red", 5));
    expect(s2.phase).toBe("act");
  });

  it("records NO feeding when an already-opened player lays the floor tile (rule exception)", () => {
    // Already-opened pairs player draws the floor tile and lays it as a new pair.
    // Per canonical rule: once opened, processing/laying the floor tile feeds no one.
    const s = state({
      discards: [[], [], [], [numbered("red", 5)]],
      players: [player(0, [numbered("red", 5)], { opened: true, openMode: "pairs" }), player(1, []), player(2, []), player(3, [])],
    });
    const drew = applyMove(s, { kind: "drawFromDiscard" }, 0); // hand: [red5, red5], floor = red5
    const laid = applyMove(drew, { kind: "openNewMeld", tiles: [numbered("red", 5), numbered("red", 5)] }, 0);
    expect(laid.pendingFloorTile).toBeNull();
    expect(laid.feedingEvents).toHaveLength(0);
  });

  it("records a ×20 (pairs) feeding event when an unopened player OPENS in pairs using the floor tile", () => {
    const pairsConfig = makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11, minPairs: 1 });
    const s = state({
      config: pairsConfig,
      phase: "act",
      pendingFloorTile: numbered("red", 5),
      players: [player(0, [numbered("red", 5), numbered("red", 5)]), player(1, []), player(2, []), player(3, [])],
    });
    const next = applyMove(s, { kind: "openPairs", pairs: [[numbered("red", 5), numbered("red", 5)]] }, 0);
    expect(next.pendingFloorTile).toBeNull();
    expect(next.feedingEvents).toHaveLength(1);
    expect(next.feedingEvents[0]).toMatchObject({ feederSeat: 3, takerSeat: 0, tileValue: 5, takerMode: "pairs" });
  });
});
