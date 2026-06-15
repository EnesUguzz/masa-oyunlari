import { describe, it, expect } from "vitest";
import {
  AppError,
  RoomFullError,
  RoomNotFoundError,
  NotYourTurnError,
  InvalidMoveError,
  ValidationError,
} from "./index.js";

describe("custom errors", () => {
  it("RoomFullError carries a stable code and is an AppError", () => {
    const err = new RoomFullError("ABCD");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("ROOM_FULL");
    expect(err.message).toContain("ABCD");
  });

  it("RoomNotFoundError has code ROOM_NOT_FOUND", () => {
    expect(new RoomNotFoundError("ZZZZ").code).toBe("ROOM_NOT_FOUND");
  });

  it("NotYourTurnError has code NOT_YOUR_TURN", () => {
    expect(new NotYourTurnError().code).toBe("NOT_YOUR_TURN");
  });

  it("InvalidMoveError has code INVALID_MOVE", () => {
    expect(new InvalidMoveError("nope").code).toBe("INVALID_MOVE");
  });

  it("ValidationError has code VALIDATION", () => {
    expect(new ValidationError("bad").code).toBe("VALIDATION");
  });
});
