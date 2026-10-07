import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { numbered } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome, FinishType, FeedingEvent } from "./game-state.js";
import { makeConfig } from "./game-config.js";
import { scoreHand } from "./scoring.js";

const okey: NumberedTile = numbered("red", 13);

function player(seat: number, hand: OkeyTile[], opened: boolean): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened, openMode: opened ? "melds" : null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false };
}

function finished(players: PlayerHandState[], outcome: HandOutcome): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey, players,
    drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 5, phase: "act", pendingFloorTile: null,
    highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: outcome.feedingEvents, meldSeq: 0, status: "finished", outcome,
  };
}

function ft(over: Partial<FinishType>): FinishType {
  return { elden: false, okey: false, pairs: false, ...over };
}
function outcome(over: Partial<HandOutcome>): HandOutcome {
  return { finisherSeat: 0, finishType: ft({}), leftovers: [], feedingEvents: [], deckExhausted: false, ...over };
}

describe("scoreHand (essiz)", () => {
  it("normal finish: finisher -101, opened loser tile sum, non-opener 202", () => {
    const players = [
      player(0, [], true),
      player(1, [numbered("blue", 9), numbered("blue", 10)], true),
      player(2, [numbered("black", 3)], false),
      player(3, [numbered("yellow", 5)], true),
    ];
    const s = finished(players, outcome({ finisherSeat: 0, finishType: ft({}) }));
    const score = scoreHand(s);
    expect(score.perSeat).toEqual([-101, 19, 202, 5]);
    expect(score.perTeam).toBeNull();
  });

  it("okey finish doubles everything (m=2)", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9), numbered("blue", 10)], true), player(2, [numbered("black", 3)], false), player(3, [numbered("yellow", 5)], true)];
    const s = finished(players, outcome({ finishType: ft({ okey: true }) }));
    expect(scoreHand(s).perSeat).toEqual([-202, 38, 404, 10]);
  });

  it("elden+okey is m=4", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9)], true), player(2, [], true), player(3, [], true)];
    const s = finished(players, outcome({ finishType: ft({ elden: true, okey: true }) }));
    expect(scoreHand(s).perSeat[0]).toBe(-404);
    expect(scoreHand(s).perSeat[1]).toBe(36);
  });

  it("adds a flat +101 when an opened loser holds a wildcard (not multiplied)", () => {
    const players = [player(0, [], true), player(1, [numbered("blue", 9), numbered("red", 13)], true), player(2, [], true), player(3, [], true)];
    const s = finished(players, outcome({ finishType: ft({ okey: true }) }));
    expect(scoreHand(s).perSeat[1]).toBe(119);
  });

  it("deck exhaustion: opened players score their leftover tiles, non-openers take 202", () => {
    const players = [
      player(0, [numbered("red", 1), numbered("blue", 9)], true), // opened: 1+9 = 10
      player(1, [numbered("black", 5), okey], true), // opened + holds okey: 5 + 101 = 106
      player(2, [numbered("red", 7)], false), // never opened: flat 202
      player(3, [], false), // never opened: flat 202
    ];
    const s = finished(players, outcome({ finisherSeat: null, finishType: null, deckExhausted: true }));
    expect(scoreHand(s).perSeat).toEqual([10, 106, 202, 202]);
  });

  it("cezali feeding: feeder charged tileValue x10 (melds) / x20 (pairs)", () => {
    const players = [player(0, [], true), player(1, [], true), player(2, [], true), player(3, [], true)];
    const feedingEvents: FeedingEvent[] = [{ feederSeat: 2, takerSeat: 3, tileValue: 5, takerMode: "melds" }];
    const s = finished(players, outcome({ finishType: ft({}), feedingEvents }));
    expect(scoreHand(s).perSeat).toEqual([-101, 0, 50, 0]);
  });

  it("adds the flat discard penalty accumulated during play (not multiplied)", () => {
    const players = [player(0, [], true), player(1, [], true), player(2, [], true), player(3, [], true)];
    players[2]!.discardPenalty = 101;
    const s = finished(players, outcome({ finishType: ft({ okey: true }) })); // m=2
    // seat 2 opened with an empty hand → 0 · m, plus the flat 101 discard penalty
    expect(scoreHand(s).perSeat[2]).toBe(101);
  });

  it("throws when the hand is not finished", () => {
    const players = [player(0, [], true), player(1, [], true), player(2, [], true), player(3, [], true)];
    const s = finished(players, outcome({}));
    s.status = "playing";
    s.outcome = null;
    expect(() => scoreHand(s)).toThrow();
  });
});
