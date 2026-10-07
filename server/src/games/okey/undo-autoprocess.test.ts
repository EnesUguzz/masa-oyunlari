import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, TableMeld } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";
import { toOkeyPlayerView } from "./view.js";

const okey: NumberedTile = numbered("red", 13);
const n = numbered;

function player(seat: number, hand: OkeyTile[], opened: boolean, openMode: "melds" | "pairs" | null, openScore = 0): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened, openMode, openScore, pairCount: 0, openedOnTurn: null, floorPenalty: false };
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

describe("autoProcess (Taşları İşle)", () => {
  it("lays every hand tile that extends a table run, keeping one to discard", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [n("blue", 4), n("blue", 5), n("blue", 6)] };
    const s = stateWith([n("blue", 7), n("blue", 8), n("red", 1)], [meld]);
    const next = applyMove(s, { kind: "autoProcess" }, 0);
    expect(next.tableMelds[0]!.tiles.length).toBe(5); // 4-5-6-7-8
    expect(next.players[0]!.hand).toEqual([n("red", 1)]); // unrelated tile kept
  });

  it("never auto-lays the okey", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [n("blue", 4), n("blue", 5), n("blue", 6)] };
    // red 13 is the okey here; appending it would be a valid extension but must be kept
    const s = stateWith([okey, n("yellow", 2)], [meld]);
    const next = applyMove(s, { kind: "autoProcess" }, 0);
    expect(next.tableMelds[0]!.tiles.length).toBe(3);
    expect(next.players[0]!.hand.length).toBe(2);
  });

  it("rejects auto-process before opening", () => {
    const meld: TableMeld = { id: "m1", owner: 1, kind: "run", tiles: [n("blue", 4), n("blue", 5), n("blue", 6)] };
    const s = stateWith([n("blue", 7)], [meld], { opened: false, openMode: null });
    expect(() => applyMove(s, { kind: "autoProcess" }, 0)).toThrow();
  });
});

describe("undoTurn (Geri Topla)", () => {
  it("undoes a processToMeld done this turn", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [n("blue", 4), n("blue", 5), n("blue", 6)] };
    const s = stateWith([n("blue", 7), n("red", 1)], [meld]);
    const processed = applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [n("blue", 7)] }, 0);
    expect(processed.tableMelds[0]!.tiles.length).toBe(4);
    expect(processed.players[0]!.hand.length).toBe(1);
    const undone = applyMove(processed, { kind: "undoTurn" }, 0);
    expect(undone.tableMelds[0]!.tiles.length).toBe(3);
    expect(undone.players[0]!.hand.length).toBe(2);
  });

  it("undoes an opening done this turn (hand, melds and opened flag restored)", () => {
    const melds = [
      [n("yellow", 11), n("yellow", 12), n("yellow", 13)],
      [n("blue", 11), n("blue", 12), n("blue", 13)],
      [n("black", 11), n("black", 12), n("black", 13)],
    ];
    const hand = [...melds.flat(), n("red", 1)];
    const s = stateWith(hand, [], { opened: false, openMode: null });
    const opened = applyMove(s, { kind: "openMelds", melds }, 0);
    expect(opened.players[0]!.opened).toBe(true);
    expect(opened.tableMelds.length).toBe(3);
    expect(opened.players[0]!.hand.length).toBe(1);

    const undone = applyMove(opened, { kind: "undoTurn" }, 0);
    expect(undone.players[0]!.opened).toBe(false);
    expect(undone.players[0]!.openScore).toBe(0);
    expect(undone.tableMelds.length).toBe(0);
    expect(undone.players[0]!.hand.length).toBe(10);
  });

  it("throws when there is nothing to undo this turn", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [n("blue", 4), n("blue", 5), n("blue", 6)] };
    const s = stateWith([n("blue", 7), n("red", 1)], [meld]);
    expect(() => applyMove(s, { kind: "undoTurn" }, 0)).toThrow();
  });

  it("after undo, the player can still discard normally", () => {
    const meld: TableMeld = { id: "m1", owner: 0, kind: "run", tiles: [n("blue", 4), n("blue", 5), n("blue", 6)] };
    const s = stateWith([n("blue", 7), n("yellow", 2)], [meld]);
    const processed = applyMove(s, { kind: "processToMeld", meldId: "m1", tiles: [n("blue", 7)] }, 0);
    const undone = applyMove(processed, { kind: "undoTurn" }, 0);
    const discarded = applyMove(undone, { kind: "discard", tile: n("yellow", 2) }, 0);
    expect(discarded.turn).toBe(1);
    expect(discarded.players[0]!.hand.length).toBe(1); // blue7 still in hand
  });
});

describe("view exposes the current opening requirement", () => {
  it("reflects katlamalı escalation (highest opened + 1)", () => {
    const s = stateWith([], []);
    s.config = makeConfig({ pairing: "essiz", escalation: "katlamali", targetHands: 11 });
    s.players[1] = player(1, [], true, "melds", 120);
    s.turn = 0; s.phase = "draw";
    const view = toOkeyPlayerView(s, 0);
    expect(view.meldOpenNeed).toBe(121);
  });

  it("is the base threshold when nobody has opened", () => {
    const s = stateWith([], []);
    s.config = makeConfig({ pairing: "essiz", escalation: "katlamali", targetHands: 11 });
    s.players[0] = player(0, [], false, null);
    const view = toOkeyPlayerView(s, 0);
    expect(view.meldOpenNeed).toBe(101);
  });
});
