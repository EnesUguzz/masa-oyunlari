import type { PlayerId } from "@masa/shared";
import type { Rng } from "../../core/rng.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import { buildDeck, shuffle } from "./deck.js";
import { deal } from "./deal.js";
import { determineOkey } from "./okey.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";

export function createHand(
  config: OkeyGameConfig,
  players: readonly PlayerId[],
  rng: Rng,
): OkeyGameState {
  if (players.length !== 4) {
    throw new InvalidMoveError("okey requires exactly 4 players");
  }
  const deck = shuffle(buildDeck(), rng);
  const { hands, indicator, drawPile } = deal(deck);
  const okey = determineOkey(indicator);

  const playerStates: PlayerHandState[] = players.map((id, seat) => ({
    seat,
    playerId: id,
    team: config.pairing === "esli" ? ((seat % 2) as 0 | 1) : null,
    hand: hands[seat]!,
    opened: false,
    openMode: null,
    openScore: 0,
    pairCount: 0,
    openedOnTurn: null,
    floorPenalty: false,
  }));

  return {
    config,
    indicator,
    okey,
    players: playerStates,
    drawPile,
    discards: [[], [], [], []],
    tableMelds: [],
    turn: 0,
    turnSeq: 0,
    // The starting player (seat 0) is dealt 22 tiles and opens the hand by
    // acting/discarding — it does NOT draw first. So the hand begins in "act".
    phase: "act",
    pendingFloorTile: null,
    highestOpenScore: null,
    highestOpenPairs: null,
    feedingEvents: [],
    meldSeq: 0,
    status: "playing",
    outcome: null,
  };
}
