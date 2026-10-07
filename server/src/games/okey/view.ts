import type { PlayerId } from "@masa/shared";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState, TableMeld, HandOutcome, GamePhase, GameStatus } from "./game-state.js";
import { meldThreshold, pairThreshold } from "./helpers.js";

export interface PublicPlayer {
  seat: number;
  playerId: PlayerId;
  team: 0 | 1 | null;
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  pairCount: number;
  // Points this player opened with (melds mode); 0 if not opened in melds.
  openScore: number;
  handCount: number;
  lastDiscard: OkeyTile | null;
}

export interface OkeyPlayerView {
  config: OkeyGameConfig;
  indicator: NumberedTile;
  okey: NumberedTile;
  you: number;
  yourHand: OkeyTile[];
  turn: number;
  phase: GamePhase;
  // The tile this player just took from the discard pile and has not yet used,
  // if any (only ever set for the seat whose turn it is). Lets the client offer
  // "put it back". null for everyone else.
  pendingFloorTile: OkeyTile | null;
  drawPileCount: number;
  players: PublicPlayer[];
  tableMelds: TableMeld[];
  // What this player currently needs to open with (reflects katlamalı escalation):
  // points for a melds opening, number of pairs for a pairs opening.
  meldOpenNeed: number;
  pairOpenNeed: number;
  // True if this player has opened/processed this turn and can still "Geri Topla".
  canUndoTurn: boolean;
  status: GameStatus;
  outcome: HandOutcome | null;
}

export function toOkeyPlayerView(state: OkeyGameState, seat: number): OkeyPlayerView {
  const you = state.players[seat];
  if (!you) throw new RangeError(`invalid seat ${seat}`);
  return {
    config: state.config,
    indicator: state.indicator,
    okey: state.okey,
    you: seat,
    yourHand: you.hand.slice(),
    turn: state.turn,
    phase: state.phase,
    pendingFloorTile: seat === state.turn && state.pendingFloorTile ? { ...state.pendingFloorTile } : null,
    drawPileCount: state.drawPile.length,
    players: state.players.map((p) => {
      const pile = state.discards[p.seat]!;
      return {
        seat: p.seat,
        playerId: p.playerId,
        team: p.team,
        opened: p.opened,
        openMode: p.openMode,
        pairCount: p.pairCount,
        openScore: p.openScore,
        handCount: p.hand.length,
        lastDiscard: pile.length > 0 ? pile[pile.length - 1]! : null,
      };
    }),
    tableMelds: state.tableMelds.map((m) => ({ ...m, tiles: m.tiles.slice() })),
    meldOpenNeed: meldThreshold(state, seat),
    pairOpenNeed: pairThreshold(state, seat),
    canUndoTurn: seat === state.turn && state.phase === "act"
      && !!state.actCheckpoint && state.actCheckpoint.turnSeq === state.turnSeq,
    status: state.status,
    outcome: state.outcome,
  };
}
