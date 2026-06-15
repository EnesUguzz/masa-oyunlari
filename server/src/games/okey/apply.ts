import { InvalidMoveError, NotYourTurnError } from "../../core/errors/index.js";
import type { OkeyTile } from "./tile.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
import { IllegalDrawError, FloorTileUnusedError } from "./errors.js";
import { cloneState, current, requirePhase, removeTilesFromHand } from "./helpers.js";
import { buildExhaustOutcome, buildFinishOutcome } from "./outcome.js";

export function applyMove(state: OkeyGameState, move: Move, bySeat: number): OkeyGameState {
  if (state.status !== "playing") throw new InvalidMoveError("hand is not in progress");
  if (bySeat !== state.turn) throw new NotYourTurnError();
  const s = cloneState(state);
  switch (move.kind) {
    case "drawFromPile": drawFromPile(s); break;
    case "drawFromDiscard": drawFromDiscard(s); break;
    case "discard": discard(s, move.tile); break;
    default: throw new InvalidMoveError(`unsupported move: ${move.kind}`);
  }
  return s;
}

function drawFromPile(s: OkeyGameState): void {
  requirePhase(s, "draw");
  if (s.drawPile.length === 0) {
    s.status = "finished";
    s.outcome = buildExhaustOutcome(s);
    return;
  }
  const tile = s.drawPile.pop()!;
  current(s).hand.push(tile);
  s.phase = "act";
}

function drawFromDiscard(s: OkeyGameState): void {
  requirePhase(s, "draw");
  const me = current(s);
  if (me.openMode === "pairs") throw new IllegalDrawError("a pairs opener cannot take from the discard");
  const prev = (s.turn + 3) % 4;
  const pile = s.discards[prev]!;
  if (pile.length === 0) throw new IllegalDrawError("no discard available to take");
  const tile = pile.pop()!;
  me.hand.push(tile);
  s.pendingFloorTile = tile;
  s.phase = "act";
}

function discard(s: OkeyGameState, tile: OkeyTile): void {
  requirePhase(s, "act");
  if (s.pendingFloorTile !== null) throw new FloorTileUnusedError();
  const me = current(s);
  removeTilesFromHand(me, [tile]);
  s.discards[me.seat]!.push(tile);
  if (me.hand.length === 0) {
    s.status = "finished";
    s.outcome = buildFinishOutcome(s, me, tile);
    return;
  }
  s.phase = "draw";
  s.turn = (s.turn + 1) % 4;
  s.turnSeq += 1;
}
