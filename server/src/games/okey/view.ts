import type { PlayerId } from "@masa/shared";
import type { OkeyTile, NumberedTile } from "./tile.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState, TableMeld, HandOutcome, GamePhase, GameStatus } from "./game-state.js";

export interface PublicPlayer {
  seat: number;
  playerId: PlayerId;
  team: 0 | 1 | null;
  opened: boolean;
  openMode: "melds" | "pairs" | null;
  pairCount: number;
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
  drawPileCount: number;
  players: PublicPlayer[];
  tableMelds: TableMeld[];
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
        handCount: p.hand.length,
        lastDiscard: pile.length > 0 ? pile[pile.length - 1]! : null,
      };
    }),
    tableMelds: state.tableMelds.map((m) => ({ ...m, tiles: m.tiles.slice() })),
    status: state.status,
    outcome: state.outcome,
  };
}
