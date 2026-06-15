import { describe, expect, it } from "vitest";
import { AppError } from "../../core/errors/index.js";
import {
  WrongPhaseError,
  IllegalDrawError,
  AlreadyOpenedError,
  NotOpenedError,
  OpeningThresholdNotMetError,
  ModeLockedError,
  FloorTileUnusedError,
  TileNotInHandError,
} from "./errors.js";

describe("okey errors", () => {
  it("are AppError subclasses with stable codes and names", () => {
    const e = new OpeningThresholdNotMetError("need 101");
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("OPENING_THRESHOLD_NOT_MET");
    expect(e.name).toBe("OpeningThresholdNotMetError");
    expect(e.message).toContain("need 101");
  });

  it("expose distinct codes", () => {
    const codes = [
      new WrongPhaseError("x").code,
      new IllegalDrawError("x").code,
      new AlreadyOpenedError().code,
      new NotOpenedError().code,
      new ModeLockedError("x").code,
      new FloorTileUnusedError().code,
      new TileNotInHandError().code,
    ];
    expect(new Set(codes).size).toBe(codes.length);
  });
});
