import { InvalidMoveError, NotYourTurnError } from "../../core/errors/index.js";
import type { OkeyTile } from "./tile.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
import { IllegalDrawError, FloorTileUnusedError } from "./errors.js";
import { cloneState, current, requirePhase, removeTilesFromHand } from "./helpers.js";
import { buildExhaustOutcome, buildFinishOutcome } from "./outcome.js";
import { applyOpenMelds, applyOpenPairs, applyProcessToMeld, applyOpenNewMeld, applyAutoOpen } from "./opening.js";

export function applyMove(state: OkeyGameState, move: Move, bySeat: number): OkeyGameState {
  if (state.status !== "playing") throw new InvalidMoveError("hand is not in progress");
  if (bySeat !== state.turn) throw new NotYourTurnError();
  const s = cloneState(state);
  switch (move.kind) {
    case "drawFromPile": drawFromPile(s); break;
    case "drawFromDiscard": drawFromDiscard(s); break;
    case "returnFloorTile": returnFloorTile(s); break;
    case "discard": discard(s, move.tile); break;
    case "openMelds": applyOpenMelds(s, move.melds); break;
    case "autoOpen": applyAutoOpen(s); break;
    case "openPairs": applyOpenPairs(s, move.pairs); break;
    case "processToMeld": applyProcessToMeld(s, move.meldId, move.tiles); break;
    case "openNewMeld": applyOpenNewMeld(s, move.tiles); break;
    default: throw new InvalidMoveError("unsupported move");
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

function returnFloorTile(s: OkeyGameState): void {
  requirePhase(s, "act");
  const me = current(s);
  if (s.pendingFloorTile === null) throw new InvalidMoveError("no floor tile to return");
  if (me.openedOnTurn === s.turnSeq) throw new InvalidMoveError("cannot return the floor tile after opening this turn");
  // Put the tile back where it came from (the previous seat's discard pile) and
  // revert to the draw phase so the player can instead draw from the deck.
  removeTilesFromHand(me, [s.pendingFloorTile]);
  const prev = (s.turn + 3) % 4;
  s.discards[prev]!.push(s.pendingFloorTile);
  s.pendingFloorTile = null;
  s.phase = "draw";
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
