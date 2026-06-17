import { describe, it, expect } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import { determineOkey, isOkeyTile, isWildcard, naturalValue } from "./okey.js";

describe("okey", () => {
  it("okey is the indicator + 1, same color", () => {
    expect(determineOkey(numbered("red", 5))).toEqual(numbered("red", 6));
  });

  it("wraps 13 -> 1 keeping color", () => {
    expect(determineOkey(numbered("blue", 13))).toEqual(numbered("blue", 1));
  });

  it("isOkeyTile matches only the exact okey tile", () => {
    const okey = numbered("red", 6);
    expect(isOkeyTile(numbered("red", 6), okey)).toBe(true);
    expect(isOkeyTile(numbered("red", 7), okey)).toBe(false);
    expect(isOkeyTile(numbered("blue", 6), okey)).toBe(false);
    expect(isOkeyTile(fakeJoker(), okey)).toBe(false);
  });

  it("isWildcard = ONLY the okey tile; the fake joker is NOT a wildcard", () => {
    const okey = numbered("red", 6);
    expect(isWildcard(numbered("red", 6), okey)).toBe(true); // the 2 real okey tiles are wild
    expect(isWildcard(fakeJoker(), okey)).toBe(false); // fake joker is a concrete okey-value tile
    expect(isWildcard(numbered("red", 5), okey)).toBe(false);
  });

  it("naturalValue: fake joker stands in for the okey-value tile; the okey tile itself is wild (null)", () => {
    const okey = numbered("red", 6);
    expect(naturalValue(fakeJoker(), okey)).toEqual(numbered("red", 6)); // concrete red 6
    expect(naturalValue(numbered("red", 6), okey)).toBeNull(); // wildcard
    expect(naturalValue(numbered("blue", 9), okey)).toEqual(numbered("blue", 9)); // plain
  });
});
