import type { PlayerId } from "@masa/shared";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameConfig } from "./game-config.js";

export interface TableMeld {
  id: string;
  owner: number;
  kind: "run" | "set" | "pair";
  tiles: OkeyTile[];
}

export interface PlayerHandState {
  seat: number;
  playerId: PlayerId;
  team: 0 | 1 | null;
  hand: OkeyTile[];
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  openScore: number;
  pairCount: number;
  openedOnTurn: number | null;
  // Set when the player opened a hand while still holding an unused tile taken
  // from the discard pile (floor). Adds a flat 101 penalty at scoring time.
  floorPenalty: boolean;
  // Per-turn bookkeeping for the pairs-opener "process at most 2 tiles onto a
  // series per turn" rule. Optional (internal counters; absent = 0 / no turn).
  processTurnSeq?: number | null;
  processedThisTurn?: number;
}

export interface FinishType {
  elden: boolean;
  okey: boolean;
  pairs: boolean;
}

export interface FeedingEvent {
  feederSeat: number;
  takerSeat: number;
  tileValue: number;
  takerMode: "melds" | "pairs";
}

export interface HandOutcome {
  finisherSeat: number | null;
  finishType: FinishType | null;
  leftovers: { seat: number; tiles: OkeyTile[] }[];
  feedingEvents: FeedingEvent[];
  deckExhausted: boolean;
}

export type GamePhase = "draw" | "act";
export type GameStatus = "playing" | "finished";

export interface OkeyGameState {
  config: OkeyGameConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  players: PlayerHandState[];
  drawPile: OkeyTile[];
  discards: OkeyTile[][];
  tableMelds: TableMeld[];
  turn: number;
  turnSeq: number;
  phase: GamePhase;
  pendingFloorTile: OkeyTile | null;
  highestOpenScore: number | null;
  highestOpenPairs: number | null;
  feedingEvents: FeedingEvent[];
  meldSeq: number;
  status: GameStatus;
  outcome: HandOutcome | null;
}
