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
  isVoid: boolean;
  deckExhausted: boolean;
}

export type GamePhase = "draw" | "act";
export type GameStatus = "playing" | "finished" | "void";

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
