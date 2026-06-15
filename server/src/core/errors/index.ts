/**
 * Base for all known, safe-to-surface application errors.
 *
 * NOTE: subclasses set `code` via a class-field initializer, which runs AFTER
 * super() under ES2022 field semantics. Do NOT read `this.code` inside this
 * constructor — it is still undefined here. Translate errors by reading `.code`
 * and `.message` explicitly at the catch site (never JSON.stringify an Error;
 * `message` is non-enumerable and would be dropped).
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RoomFullError extends AppError {
  readonly code = "ROOM_FULL";
  constructor(roomCode: string) {
    super(`Room ${roomCode} is full`);
  }
}

export class RoomNotFoundError extends AppError {
  readonly code = "ROOM_NOT_FOUND";
  constructor(roomCode: string) {
    super(`Room ${roomCode} not found`);
  }
}

export class NotYourTurnError extends AppError {
  readonly code = "NOT_YOUR_TURN";
  constructor() {
    super("It is not your turn");
  }
}

export class InvalidMoveError extends AppError {
  readonly code = "INVALID_MOVE";
  constructor(reason: string) {
    super(`Invalid move: ${reason}`);
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION";
  constructor(message: string) {
    super(message);
  }
}
