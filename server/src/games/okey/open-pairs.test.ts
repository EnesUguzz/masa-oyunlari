import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { applyMove } from "./apply.js";
import { validatePairsOpening } from "./opening.js";

const okey: NumberedTile = numbered("red", 13);
const indicator: NumberedTile = numbered("red", 12);

function pair(color: "red" | "yellow" | "black" | "blue", value: number): OkeyTile[] {
  return [numbered(color, value), numbered(color, value)];
}

function blankPlayer(seat: number, hand: OkeyTile[]): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false };
}

function pairsState(hand: OkeyTile[], openModes: ("pairs" | null)[] = [null, null, null, null]): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator, okey,
    players: openModes.map((m, seat) => {
      const p = blankPlayer(seat, seat === 0 ? hand : []);
      if (m === "pairs") { p.opened = true; p.openMode = "pairs"; p.pairCount = 5; }
      return p;
    }),
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

describe("validatePairsOpening", () => {
  it("accepts five identical pairs", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(true);
  });
  it("accepts a pair completed by a wildcard (the okey tile)", () => {
    const pairs = [[numbered("red", 1), numbered("red", 13)], pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(true);
  });
  it("allows the indicator tile to form ONE pair with any tile (gösterge +1)", () => {
    const pairs = [[indicator, numbered("blue", 7)], pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(true);
  });
  it("rejects two non-matching, non-wildcard tiles", () => {
    const pairs = [[numbered("red", 1), numbered("blue", 7)], pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    expect(validatePairsOpening(pairs, okey, indicator)).toBe(false);
  });
});

describe("applyOpenPairs", () => {
  it("opens with five pairs and locks pairs mode", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    const s = pairsState(pairs.flat());
    const next = applyMove(s, { kind: "openPairs", pairs }, 0);
    expect(next.players[0]!.opened).toBe(true);
    expect(next.players[0]!.openMode).toBe("pairs");
    expect(next.players[0]!.pairCount).toBe(5);
    expect(next.tableMelds.length).toBe(5);
    expect(next.tableMelds.every((m) => m.kind === "pair")).toBe(true);
  });

  it("rejects four pairs (below minPairs)", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4)];
    const s = pairsState(pairs.flat());
    expect(() => applyMove(s, { kind: "openPairs", pairs }, 0)).toThrow();
  });

  it("allows a fourth player to open pairs without voiding the hand", () => {
    const pairs = [pair("red", 1), pair("red", 2), pair("red", 3), pair("red", 4), pair("red", 5)];
    const s = pairsState(pairs.flat(), [null, "pairs", "pairs", "pairs"]);
    const next = applyMove(s, { kind: "openPairs", pairs }, 0);
    expect(next.status).toBe("playing");
    expect(next.players[0]!.openMode).toBe("pairs");
  });
});
