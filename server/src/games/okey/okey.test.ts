import { describe, it, expect } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import { determineOkey, isOkeyTile, isWildcard } from "./okey.js";

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

  it("isWildcard = fake joker OR the okey tile (4 wildcards total)", () => {
    const okey = numbered("red", 6);
    expect(isWildcard(fakeJoker(), okey)).toBe(true);
    expect(isWildcard(numbered("red", 6), okey)).toBe(true);
    expect(isWildcard(numbered("red", 5), okey)).toBe(false);
  });
});
