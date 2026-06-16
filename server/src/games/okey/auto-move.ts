import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";

/**
 * The safest moves to pass the current seat's turn on timeout. Never produces an
 * illegal move. Draw phase -> draw from the pile. Act phase -> discard the last
 * hand tile. If a floor tile is pending (the seat manually drew from the discard
 * and stalled), returns [] and the turn is left open (the UI prevents this case).
 */
export function autoMoves(hand: OkeyGameState): Move[] {
  if (hand.phase === "draw") return [{ kind: "drawFromPile" }];
  if (hand.pendingFloorTile !== null) return [];
  const me = hand.players[hand.turn]!;
  const tile = me.hand[me.hand.length - 1];
  if (!tile) return [];
  return [{ kind: "discard", tile }];
}
