import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome, FinishType, FeedingEvent } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { scoreHand } from "./scoring.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: (seat % 2) as 0 | 1, hand, opened, openMode: opened ? "melds" : null, openScore: 0, pairCount: 0, openedOnTurn: null };
}

function ft(over: Partial<FinishType>): FinishType {
  return { elden: false, okey: false, pairs: false, ...over };
}

function esliFinished(players: PlayerHandState[], outcome: HandOutcome, penalty: "cezasiz" | "cezali" = "cezasiz"): OkeyGameState {
  return {
    config: makeConfig({ pairing: "esli", escalation: "katlamasiz", penalty, targetHands: 11 }),
    indicator: numbered("red", 12), okey, players,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 5, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: outcome.feedingEvents, meldSeq: 0, status: "finished", outcome,
  };
}

describe("scoreHand (esli)", () => {
  it("normal finish: finishing team 0, partner penalty forgiven", () => {
    const players = [
      player(0, [], true),
      player(1, [numbered("blue", 9)], true),
      player(2, [numbered("black", 8)], true),
      player(3, [numbered("yellow", 4)], false),
    ];
    const score = scoreHand(esliFinished(players, { finisherSeat: 0, finishType: ft({}), leftovers: [], feedingEvents: [], deckExhausted: false }));
    expect(score.perSeat[0]).toBe(0);
    expect(score.perSeat[2]).toBe(0);
    expect(score.perTeam![0]).toBe(0);
    expect(score.perTeam![1]).toBe(9 + 202);
  });

  it("special finish (okey, m=2): finishing team -202", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9)], true), player(2, [numbered("black", 8)], true), player(3, [], false)];
    const score = scoreHand(esliFinished(players, { finisherSeat: 0, finishType: ft({ okey: true }), leftovers: [], feedingEvents: [], deckExhausted: false }));
    expect(score.perTeam![0]).toBe(-202);
    expect(score.perTeam![1]).toBe(9 * 2 + 202 * 2);
  });

  it("deck exhaustion in esli: every seat 202, teams 404 each", () => {
    const players = [player(0, [], false), player(1, [], false), player(2, [], false), player(3, [], false)];
    const score = scoreHand(esliFinished(players, { finisherSeat: null, finishType: null, leftovers: [], feedingEvents: [], deckExhausted: true }));
    expect(score.perTeam).toEqual([404, 404]);
  });
});

describe("scoreHand feeding coverage", () => {
  it("feeding with takerMode pairs charges x20", () => {
    const players = [player(0, [], true), player(1, [], true), player(2, [], true), player(3, [], true)];
    const feedingEvents: FeedingEvent[] = [{ feederSeat: 1, takerSeat: 2, tileValue: 6, takerMode: "pairs" }];
    // essiz config to read raw perSeat without team override:
    const s: OkeyGameState = {
      config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezali", targetHands: 11 }),
      indicator: numbered("red", 12), okey, players,
      drawPile: [], discards: [[], [], [], []], tableMelds: [],
      turn: 0, turnSeq: 5, phase: "act", pendingFloorTile: null,
      highestOpenScore: null, highestOpenPairs: null,
      feedingEvents, meldSeq: 0, status: "finished",
      outcome: { finisherSeat: 0, finishType: ft({}), leftovers: [], feedingEvents, deckExhausted: false },
    };
    expect(scoreHand(s).perSeat[1]).toBe(6 * 20); // 120
  });

  it("feeding applies on the deck-exhaustion path too (essiz)", () => {
    const players = [player(0, [], false), player(1, [], false), player(2, [], false), player(3, [], false)];
    const feedingEvents: FeedingEvent[] = [{ feederSeat: 0, takerSeat: 1, tileValue: 4, takerMode: "melds" }];
    const s: OkeyGameState = {
      config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezali", targetHands: 11 }),
      indicator: numbered("red", 12), okey, players,
      drawPile: [], discards: [[], [], [], []], tableMelds: [],
      turn: 0, turnSeq: 5, phase: "act", pendingFloorTile: null,
      highestOpenScore: null, highestOpenPairs: null,
      feedingEvents, meldSeq: 0, status: "finished",
      outcome: { finisherSeat: null, finishType: null, leftovers: [], feedingEvents, deckExhausted: true },
    };
    expect(scoreHand(s).perSeat[0]).toBe(202 + 4 * 10); // 242
  });
});
