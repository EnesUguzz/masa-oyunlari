import { InvalidMoveError } from "../../core/errors/index.js";
import { isWildcard } from "./okey.js";
import { tileValue } from "./points.js";
import { isNumbered } from "./tile.js";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameState, FinishType } from "./game-state.js";

export interface HandScore {
  perSeat: number[];
  perTeam: [number, number] | null;
}

function finishMultiplier(ft: FinishType): number {
  let k = 0;
  if (ft.elden) k += 1;
  if (ft.okey) k += 1;
  if (ft.pairs) k += 1;
  return 2 ** k;
}

function tilesValue(hand: readonly OkeyTile[]): number {
  let sum = 0;
  for (const t of hand) if (isNumbered(t)) sum += tileValue(t);
  return sum;
}

function hasWildcard(hand: readonly OkeyTile[], okey: NumberedTile): boolean {
  return hand.some((t) => isWildcard(t, okey));
}

export function scoreHand(state: OkeyGameState): HandScore {
  if (state.status !== "finished" || state.outcome === null) {
    throw new InvalidMoveError("cannot score a hand that is not finished");
  }
  const outcome = state.outcome;
  const base = [0, 0, 0, 0];

  if (outcome.deckExhausted) {
    base[0] = 202;
    base[1] = 202;
    base[2] = 202;
    base[3] = 202;
  } else {
    const finisher = outcome.finisherSeat;
    if (finisher === null || outcome.finishType === null) {
      throw new InvalidMoveError("finished hand has no finisher and is not deck-exhausted");
    }
    const m = finishMultiplier(outcome.finishType);
    for (const p of state.players) {
      if (p.seat === finisher) {
        base[p.seat] = -101 * m;
      } else if (!p.opened) {
        base[p.seat] = 202 * m;
      } else {
        base[p.seat] = tilesValue(p.hand) * m + (hasWildcard(p.hand, state.okey) ? 101 : 0);
      }
    }
  }

  if (state.config.penalty === "cezali") {
    for (const ev of outcome.feedingEvents) {
      const add = ev.tileValue * (ev.takerMode === "melds" ? 10 : 20);
      base[ev.feederSeat] = (base[ev.feederSeat] ?? 0) + add;
    }
  }

  if (state.config.pairing !== "esli") {
    return { perSeat: base, perTeam: null };
  }

  const perSeat = base.slice();
  if (!outcome.deckExhausted && outcome.finisherSeat !== null && outcome.finishType !== null) {
    const finisher = outcome.finisherSeat;
    const m = finishMultiplier(outcome.finishType);
    const finisherTeam = state.players[finisher]!.team;
    const partner = state.players.find((p) => p.seat !== finisher && p.team === finisherTeam);
    perSeat[finisher] = m === 1 ? 0 : -101 * m;
    if (partner) perSeat[partner.seat] = 0;
  }
  const team0 = perSeat[0]! + perSeat[2]!;
  const team1 = perSeat[1]! + perSeat[3]!;
  return { perSeat, perTeam: [team0, team1] };
}
