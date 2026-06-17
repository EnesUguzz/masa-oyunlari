import { describe, it, expect } from "vitest";
import { numbered, type OkeyTile } from "./tile.js";
import { tileValue, meldValue, meldsTotal, canOpenWithMelds } from "./points.js";
import { InvalidMoveError } from "../../core/errors/index.js";

const OKEY = numbered("black", 1);

describe("points", () => {
  it("tileValue is the tile's number", () => {
    expect(tileValue(numbered("red", 9))).toBe(9);
  });

  it("meldValue sums represented values (wildcard counts as represented tile)", () => {
    expect(meldValue([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toBe(18);
    expect(meldValue([numbered("red", 6), numbered("red", 7), numbered("black", 1)], OKEY)).toBe(21); // okey wild = 8
    expect(meldValue([numbered("red", 7), numbered("yellow", 7), numbered("black", 1)], OKEY)).toBe(21); // okey wild = 7
  });

  it("meldValue throws InvalidMoveError for an invalid meld", () => {
    expect(() => meldValue([numbered("red", 5), numbered("blue", 9)], OKEY)).toThrow(InvalidMoveError);
  });

  it("meldsTotal sums multiple melds", () => {
    const a: OkeyTile[] = [numbered("red", 10), numbered("red", 11), numbered("red", 12)];
    const b: OkeyTile[] = [numbered("blue", 9), numbered("yellow", 9), numbered("black", 9)];
    expect(meldsTotal([a, b], OKEY)).toBe(60);
  });

  it("canOpenWithMelds enforces validity AND the threshold (default 101)", () => {
    const m1: OkeyTile[] = [numbered("red", 11), numbered("red", 12), numbered("red", 13)];
    const m2: OkeyTile[] = [numbered("blue", 11), numbered("blue", 12), numbered("blue", 13)];
    const m3: OkeyTile[] = [numbered("yellow", 9), numbered("yellow", 10), numbered("yellow", 11)];
    expect(canOpenWithMelds([m1, m2, m3], OKEY)).toBe(true);
    expect(canOpenWithMelds([m1, m2], OKEY)).toBe(false);
  });

  it("canOpenWithMelds returns false (no throw) if any meld is invalid", () => {
    const bad: OkeyTile[] = [numbered("red", 5), numbered("blue", 9)];
    expect(canOpenWithMelds([bad], OKEY)).toBe(false);
  });

  it("honors a custom minPoints (katlamalı escalation in 1b)", () => {
    const m1: OkeyTile[] = [numbered("red", 11), numbered("red", 12), numbered("red", 13)];
    expect(canOpenWithMelds([m1], OKEY, 30)).toBe(true);
    expect(canOpenWithMelds([m1], OKEY, 50)).toBe(false);
  });
});
