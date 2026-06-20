import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean, openMode: "melds" | "pairs" | null, openedOnTurn: number | null): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened, openMode, openScore: 0, pairCount: 0, openedOnTurn, floorPenalty: false };
}

function actState(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 3, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
    ...over,
  };
}

describe("finish detection", () => {
  it("finishes when the last tile is discarded and records leftovers", () => {
    const s = actState({
      players: [
        player(0, [numbered("red", 1)], true, "melds", 1),
        player(1, [numbered("blue", 9), numbered("blue", 10)], true, "melds", 0),
        player(2, [numbered("black", 3)], false, null, null),
        player(3, [], true, "melds", 0),
      ],
    });
    const next = applyMove(s, { kind: "discard", tile: numbered("red", 1) }, 0);
    expect(next.status).toBe("finished");
    expect(next.outcome?.finisherSeat).toBe(0);
    expect(next.outcome?.leftovers.find((l) => l.seat === 1)?.tiles.length).toBe(2);
  });

  it("flags okey finish when the discarded last tile is a wildcard (the okey tile)", () => {
    const s = actState({ players: [player(0, [numbered("red", 13)], true, "melds", 1), player(1, [], true, "melds", 0), player(2, [], true, "melds", 0), player(3, [], true, "melds", 0)] });
    const next = applyMove(s, { kind: "discard", tile: numbered("red", 13) }, 0);
    expect(next.outcome?.finishType?.okey).toBe(true);
  });

  it("flags elden finish when the player opened on the finishing turn", () => {
    const s = actState({ players: [player(0, [numbered("red", 1)], true, "melds", 3), player(1, [], true, "melds", 0), player(2, [], true, "melds", 0), player(3, [], true, "melds", 0)] });
    const next = applyMove(s, { kind: "discard", tile: numbered("red", 1) }, 0);
    expect(next.outcome?.finishType?.elden).toBe(true);
  });

  it("rejects discarding while a floor tile is still unused", () => {
    const s = actState({ players: [player(0, [numbered("red", 1), numbered("red", 2)], false, null, null)], pendingFloorTile: numbered("red", 2) });
    s.players.push(player(1, [], false, null, null), player(2, [], false, null, null), player(3, [], false, null, null));
    expect(() => applyMove(s, { kind: "discard", tile: numbered("red", 1) }, 0)).toThrow();
  });
});

describe("feeding events", () => {
  it("records a feeding event when an unopened taker opens using the floor tile", () => {
    const meldA = [numbered("black", 4), numbered("black", 5), numbered("black", 6)];
    const meldB = [numbered("blue", 10), numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)];
    const meldC = [numbered("yellow", 10), numbered("yellow", 11), numbered("yellow", 12), numbered("yellow", 13)];
    const handAfterTake = [...meldA, ...meldB, ...meldC, numbered("black", 7)];
    const s = actState({
      players: [
        player(0, handAfterTake, false, null, null),
        player(1, [], false, null, null), player(2, [], false, null, null), player(3, [], false, null, null),
      ],
      pendingFloorTile: numbered("black", 7),
    });
    const melds = [[...meldA, numbered("black", 7)], meldB, meldC];
    const next = applyMove(s, { kind: "openMelds", melds }, 0);
    expect(next.feedingEvents.length).toBe(1);
    expect(next.feedingEvents[0]).toMatchObject({ feederSeat: 3, takerSeat: 0, tileValue: 7, takerMode: "melds" });
    expect(next.pendingFloorTile).toBeNull();
  });

  it("records no feeding event when the taker had already opened", () => {
    const meldExtra = [numbered("black", 5), numbered("black", 6), numbered("black", 7)];
    const s = actState({
      players: [
        player(0, [...meldExtra], true, "melds", 0),
        player(1, [], false, null, null), player(2, [], false, null, null), player(3, [], false, null, null),
      ],
      pendingFloorTile: numbered("black", 7),
    });
    const next = applyMove(s, { kind: "openNewMeld", tiles: meldExtra }, 0);
    expect(next.feedingEvents.length).toBe(0);
    expect(next.pendingFloorTile).toBeNull();
  });
});
