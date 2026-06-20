import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, TableMeld } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean, openMode: "melds" | "pairs" | null): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened, openMode, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false };
}

function stateWith(hand: OkeyTile[], melds: TableMeld[], opts?: { opened?: boolean; openMode?: "melds" | "pairs" | null }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey,
    players: [
      player(0, hand, opts?.opened ?? true, opts?.openMode ?? "melds"),
      player(1, [], false, null), player(2, [], false, null), player(3, [], false, null),
    ],
    drawPile: [], discards: [[], [], [], []], tableMelds: melds,
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 5, status: "playing", outcome: null,
  };
}

describe("processToMeld", () => {
  it("extends an existing run on the table (any owner)", () => {
    const meld: TableMeld = { id: "m1", owner: 1, kind: "run", tiles: [numbered("blue", 4), numbered("blue", 5), numbered("blue", 6)] };
    const s = stateWith([numbered("blue", 7)], [meld]);
    const next = applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [numbered("blue", 7)] }, 0);
    expect(next.tableMelds[0]!.tiles.length).toBe(4);
    expect(next.players[0]!.hand.length).toBe(0);
  });

  it("rejects a tile that does not extend the meld", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [numbered("blue", 4), numbered("blue", 5), numbered("blue", 6)] };
    const s = stateWith([numbered("red", 1)], [meld]);
    expect(() => applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [numbered("red", 1)] }, 0)).toThrow();
  });

  it("rejects processing before the player has opened", () => {
    const meld: TableMeld = { id: "m1", owner: 1, kind: "run", tiles: [numbered("blue", 4), numbered("blue", 5), numbered("blue", 6)] };
    const s = stateWith([numbered("blue", 7)], [meld], { opened: false, openMode: null });
    expect(() => applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [numbered("blue", 7)] }, 0)).toThrow();
  });
});

describe("openNewMeld", () => {
  it("lays a new valid run for a melds-mode opener", () => {
    const tiles = [numbered("black", 4), numbered("black", 5), numbered("black", 6)];
    const s = stateWith([...tiles], []);
    const next = applyMove(s, { kind: "openNewMeld", tiles }, 0);
    expect(next.tableMelds.length).toBe(1);
    expect(next.tableMelds[0]!.kind).toBe("run");
    expect(next.players[0]!.hand.length).toBe(0);
  });

  it("lets a pairs-mode opener lay a new pair but not a run", () => {
    const s = stateWith([numbered("black", 8), numbered("black", 8)], [], { openMode: "pairs" });
    const next = applyMove(s, { kind: "openNewMeld", tiles: [numbered("black", 8), numbered("black", 8)] }, 0);
    expect(next.tableMelds[0]!.kind).toBe("pair");
  });
});
