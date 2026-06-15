import { isWildcard } from "./okey.js";
import type { OkeyTile } from "./tile.js";
import type { OkeyGameState, PlayerHandState, HandOutcome } from "./game-state.js";

function leftoversOf(s: OkeyGameState, exceptSeat: number | null): HandOutcome["leftovers"] {
  return s.players
    .filter((p) => p.seat !== exceptSeat)
    .map((p) => ({ seat: p.seat, tiles: p.hand.slice() }));
}

export function buildFinishOutcome(s: OkeyGameState, finisher: PlayerHandState, lastTile: OkeyTile): HandOutcome {
  return {
    finisherSeat: finisher.seat,
    finishType: {
      elden: finisher.openedOnTurn === s.turnSeq,
      okey: isWildcard(lastTile, s.okey),
      pairs: finisher.openMode === "pairs",
    },
    leftovers: leftoversOf(s, finisher.seat),
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    isVoid: false,
    deckExhausted: false,
  };
}

export function buildVoidOutcome(s: OkeyGameState): HandOutcome {
  return {
    finisherSeat: null,
    finishType: null,
    leftovers: leftoversOf(s, null),
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    isVoid: true,
    deckExhausted: false,
  };
}

export function buildExhaustOutcome(s: OkeyGameState): HandOutcome {
  return {
    finisherSeat: null,
    finishType: null,
    leftovers: leftoversOf(s, null),
    feedingEvents: s.feedingEvents.map((e) => ({ ...e })),
    isVoid: false,
    deckExhausted: true,
  };
}
