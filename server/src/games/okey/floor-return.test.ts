import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";
import { scoreHand } from "./scoring.js";

const okey: NumberedTile = numbered("red", 13);
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
    meldSeq: 0, status: "playing", outcome: null, ...over,
  };
}

const run = (color: "red" | "yellow" | "black" | "blue", a: number): OkeyTile[] => [numbered(color, a), numbered(color, a + 1), numbered(color, a + 2)];

describe("floor tile: return and penalty", () => {
  it("returnFloorTile puts the tile back on the previous pile and reverts to draw", () => {
    const floor = numbered("yellow", 5);
    const s = actState({
      turn: 1,
      players: [player(0, []), player(1, [numbered("blue", 8), floor]), player(2, []), player(3, [])],
      discards: [[], [], [], []],
      pendingFloorTile: floor,
    });
    const s2 = applyMove(s, { kind: "returnFloorTile" }, 1);
    expect(s2.pendingFloorTile).toBeNull();
    expect(s2.phase).toBe("draw");
    expect(s2.players[1]!.hand).toHaveLength(1); // floor tile removed
    expect(s2.discards[0]).toContainEqual(floor); // back on the previous seat's pile
  });

  it("rejects returnFloorTile when no tile is pending", () => {
    const s = actState({ players: [player(0, [numbered("blue", 8)]), player(1, []), player(2, []), player(3, [])] });
    expect(() => applyMove(s, { kind: "returnFloorTile" }, 0)).toThrow();
  });

  it("opening without using the floor tile sets the 101 penalty and clears pending", () => {
    const floor = numbered("yellow", 5);
    // Three 11-12-13 runs = 108 (>=101), opened without the floor tile (yellow 5).
    const hand: OkeyTile[] = [...run("black", 11), ...run("blue", 11), ...run("yellow", 11), floor, numbered("red", 1)];
    const s = actState({
      players: [player(0, hand), player(1, []), player(2, []), player(3, [])],
      pendingFloorTile: floor,
    });
    const opened = applyMove(s, { kind: "openMelds", melds: [run("black", 11), run("blue", 11), run("yellow", 11)] }, 0);
    expect(opened.players[0]!.opened).toBe(true);
    expect(opened.players[0]!.floorPenalty).toBe(true);
    expect(opened.pendingFloorTile).toBeNull(); // cleared, so the player can now discard
  });

  it("scoreHand adds a flat 101 for a player with floorPenalty", () => {
    const outcome: HandOutcome = {
      finisherSeat: 1, finishType: { elden: false, okey: false, pairs: false },
      leftovers: [], feedingEvents: [], deckExhausted: false,
    };
    const withPenalty = actState({
      status: "finished", outcome,
      players: [
        player(0, [numbered("blue", 4)], { opened: true, openMode: "melds", floorPenalty: true }),
        player(1, [], { opened: true, openMode: "melds" }),
        player(2, [numbered("blue", 4)], { opened: true, openMode: "melds" }),
        player(3, [numbered("blue", 4)], { opened: true, openMode: "melds" }),
      ],
    });
    const score = scoreHand(withPenalty);
    // seat 0: 4 (held tile) + 101 (floor penalty); seat 2/3: just 4
    expect(score.perSeat[0]).toBe(4 + 101);
    expect(score.perSeat[2]).toBe(4);
  });
});
