import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[]): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false };
}

describe("engine integration", () => {
  it("plays a full opening-to-finish turn without mutating inputs", () => {
    const m1 = [numbered("black", 10), numbered("black", 11), numbered("black", 12), numbered("black", 13)];
    const m2 = [numbered("blue", 10), numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)];
    const m3 = [numbered("yellow", 5), numbered("yellow", 6), numbered("yellow", 7)];
    const extra = numbered("red", 1);
    const hand = [...m1, ...m2, ...m3, extra];

    const s0: OkeyGameState = {
      config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
      indicator: numbered("red", 12), okey,
      players: [player(0, hand), player(1, []), player(2, []), player(3, [])],
      drawPile: [numbered("red", 8)], discards: [[], [], [], []], tableMelds: [],
      turn: 0, turnSeq: 0, phase: "draw", pendingFloorTile: null,
      highestOpenScore: null, highestOpenPairs: null,
      feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
    };
    const snapshot = JSON.stringify(s0);

    let s = applyMove(s0, { kind: "drawFromPile" }, 0);
    s = applyMove(s, { kind: "openMelds", melds: [m1, m2, m3] }, 0);
    expect(s.players[0]!.opened).toBe(true);
    s = applyMove(s, { kind: "discard", tile: numbered("red", 8) }, 0);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe("draw");

    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it("finishes the hand when the player empties their hand on discard", () => {
    const m1 = [numbered("black", 10), numbered("black", 11), numbered("black", 12), numbered("black", 13)];
    const m2 = [numbered("blue", 10), numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)];
    const m3 = [numbered("yellow", 5), numbered("yellow", 6), numbered("yellow", 7)];
    const last = numbered("red", 1);
    const hand = [...m1, ...m2, ...m3, last];
    const s0: OkeyGameState = {
      config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
      indicator: numbered("red", 12), okey,
      players: [player(0, hand), player(1, []), player(2, []), player(3, [])],
      drawPile: [], discards: [[], [], [], []], tableMelds: [],
      turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
      highestOpenScore: null, highestOpenPairs: null,
      feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
    };
    let s = applyMove(s0, { kind: "openMelds", melds: [m1, m2, m3] }, 0);
    s = applyMove(s, { kind: "discard", tile: last }, 0);
    expect(s.status).toBe("finished");
    expect(s.outcome?.finisherSeat).toBe(0);
    expect(s.outcome?.finishType?.elden).toBe(true);
  });
});
