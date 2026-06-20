import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, TableMeld } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

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
    meldSeq: 1, status: "playing", outcome: null, ...over,
  };
}

const pair = (color: "red" | "yellow" | "black" | "blue", v: number): OkeyTile[] => [numbered(color, v), numbered(color, v)];

describe("mixed mode: melds opener melts pairs / pairs opener processes onto series", () => {
  it("a melds opener may melt a leftover pair once a pairs opener exists", () => {
    const s = actState({
      players: [
        player(0, [...pair("blue", 4), numbered("black", 1)], { opened: true, openMode: "melds" }),
        player(1, [], { opened: true, openMode: "pairs" }),
        player(2, []), player(3, []),
      ],
    });
    const s2 = applyMove(s, { kind: "openNewMeld", tiles: pair("blue", 4) }, 0);
    expect(s2.tableMelds.some((m) => m.kind === "pair" && m.owner === 0)).toBe(true);
    expect(s2.players[0]!.hand).toHaveLength(1);
  });

  it("a melds opener cannot melt a pair when nobody opened in pairs", () => {
    const s = actState({
      players: [
        player(0, [...pair("blue", 4), numbered("black", 1)], { opened: true, openMode: "melds" }),
        player(1, [], { opened: true, openMode: "melds" }),
        player(2, []), player(3, []),
      ],
    });
    expect(() => applyMove(s, { kind: "openNewMeld", tiles: pair("blue", 4) }, 0)).toThrow();
  });

  it("a pairs opener may process at most 2 tiles onto a series per turn", () => {
    const series: TableMeld = { id: "0", owner: 1, kind: "run", tiles: [numbered("red", 5), numbered("red", 6), numbered("red", 7)] };
    const s = actState({
      tableMelds: [series],
      players: [
        player(0, [numbered("red", 8), numbered("red", 9), numbered("red", 10)], { opened: true, openMode: "pairs" }),
        player(1, [], { opened: true, openMode: "pairs" }),
        player(2, []), player(3, []),
      ],
    });
    const s1 = applyMove(s, { kind: "processToMeld", meldId: "0", tiles: [numbered("red", 8)] }, 0);
    const s2 = applyMove(s1, { kind: "processToMeld", meldId: "0", tiles: [numbered("red", 9)] }, 0);
    // a third tile this turn exceeds the 2-tile limit
    expect(() => applyMove(s2, { kind: "processToMeld", meldId: "0", tiles: [numbered("red", 10)] }, 0)).toThrow();
  });

  it("a melds opener has no per-turn processing limit", () => {
    const series: TableMeld = { id: "0", owner: 0, kind: "run", tiles: [numbered("red", 5), numbered("red", 6), numbered("red", 7)] };
    const s = actState({
      tableMelds: [series],
      players: [
        player(0, [numbered("red", 8), numbered("red", 9), numbered("red", 10)], { opened: true, openMode: "melds" }),
        player(1, []), player(2, []), player(3, []),
      ],
    });
    let cur = s;
    for (const v of [8, 9, 10]) cur = applyMove(cur, { kind: "processToMeld", meldId: "0", tiles: [numbered("red", v)] }, 0);
    expect(cur.tableMelds[0]!.tiles).toHaveLength(6); // all three added, no limit
  });
});
