import { AppError } from "../../core/errors/index.js";

export class WrongPhaseError extends AppError {
  readonly code = "WRONG_PHASE";
  constructor(reason: string) {
    super(`Wrong phase: ${reason}`);
  }
}

export class IllegalDrawError extends AppError {
  readonly code = "ILLEGAL_DRAW";
  constructor(reason: string) {
    super(`Illegal draw: ${reason}`);
  }
}

export class AlreadyOpenedError extends AppError {
  readonly code = "ALREADY_OPENED";
  constructor() {
    super("Player has already opened this hand");
  }
}

export class NotOpenedError extends AppError {
  readonly code = "NOT_OPENED";
  constructor() {
    super("Player must open before laying tiles on the table");
  }
}

export class OpeningThresholdNotMetError extends AppError {
  readonly code = "OPENING_THRESHOLD_NOT_MET";
  constructor(reason: string) {
    super(`Opening threshold not met: ${reason}`);
  }
}

export class ModeLockedError extends AppError {
  readonly code = "MODE_LOCKED";
  constructor(reason: string) {
    super(`Mode locked: ${reason}`);
  }
}

export class FloorTileUnusedError extends AppError {
  readonly code = "FLOOR_TILE_UNUSED";
  constructor() {
    super("A tile taken from the discard pile must be used this turn");
  }
}

export class TileNotInHandError extends AppError {
  readonly code = "TILE_NOT_IN_HAND";
  constructor() {
    super("A tile in the move is not in the player's hand");
  }
}
