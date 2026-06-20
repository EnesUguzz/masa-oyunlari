import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { meldThreshold } from "./helpers.js";

const okey: NumberedTile = numbered("red", 13);

function p(seat: number, opened: boolean, openMode: "melds" | "pairs" | null, openScore: number): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: (seat % 2) as 0 | 1, hand: [], opened, openMode, openScore, pairCount: 0, openedOnTurn: null, floorPenalty: false };
}

function state(partnerEscalation: "ese-katlamali" | "ese-katlamasiz", players: PlayerHandState[], turn: number): OkeyGameState {
  return {
    config: makeConfig({ pairing: "esli", escalation: "katlamali", targetHands: 11, partnerEscalation }),
    indicator: numbered("red", 12), okey, players,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn, turnSeq: 0, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null,
  };
}

describe("meldThreshold team awareness", () => {
  it("ese-katlamasiz: ignores the partner's open (only opponents raise the bar)", () => {
    const s = state("ese-katlamasiz", [p(0, false, null, 0), p(1, false, null, 0), p(2, true, "melds", 120), p(3, false, null, 0)], 0);
    expect(meldThreshold(s)).toBe(101);
  });

  it("ese-katlamasiz: must still beat an opponent's open", () => {
    const s = state("ese-katlamasiz", [p(0, false, null, 0), p(1, true, "melds", 130), p(2, true, "melds", 120), p(3, false, null, 0)], 0);
    expect(meldThreshold(s)).toBe(131);
  });

  it("ese-katlamali: partner's open raises the bar too", () => {
    const s = state("ese-katlamali", [p(0, false, null, 0), p(1, false, null, 0), p(2, true, "melds", 120), p(3, false, null, 0)], 0);
    expect(meldThreshold(s)).toBe(121);
  });
});
