import { describe, it, expect } from "vitest";
import { numbered, fakeJoker, type OkeyTile } from "./tile.js";
import { isPair, isAllPairs, canOpenWithPairs } from "./pairs.js";

const OKEY = numbered("black", 1); // wildcards: fake jokers + black 1

describe("isPair", () => {
  it("is true for two identical numbered tiles", () => {
    expect(isPair(numbered("red", 7), numbered("red", 7), OKEY)).toBe(true);
  });
  it("is false for same number but different color", () => {
    expect(isPair(numbered("red", 7), numbered("blue", 7), OKEY)).toBe(false);
  });
  it("the okey tile (wildcard) pairs with anything; a fake joker only pairs with the okey-value tile", () => {
    expect(isPair(numbered("black", 1), numbered("red", 7), OKEY)).toBe(true); // okey tile is wild
    expect(isPair(fakeJoker(), numbered("red", 7), OKEY)).toBe(false); // fake joker = black 1, not red 7
    expect(isPair(fakeJoker(), fakeJoker(), OKEY)).toBe(true); // two black 1s pair
    expect(isPair(fakeJoker(), numbered("black", 1), OKEY)).toBe(true); // black 1 + okey (wild)
  });
});

describe("isAllPairs", () => {
  it("is true when every tile pairs up", () => {
    const hand: OkeyTile[] = [
      numbered("red", 7), numbered("red", 7),
      numbered("blue", 3), numbered("blue", 3),
    ];
    expect(isAllPairs(hand, OKEY)).toBe(true);
  });
  it("uses wildcards (the okey tile) to complete odd singletons", () => {
    const hand: OkeyTile[] = [numbered("red", 7), numbered("red", 7), numbered("blue", 3), numbered("black", 1)];
    expect(isAllPairs(hand, OKEY)).toBe(true);
  });
  it("is false for odd length", () => {
    expect(isAllPairs([numbered("red", 7)], OKEY)).toBe(false);
    expect(isAllPairs([numbered("red", 7), numbered("blue", 3), numbered("yellow", 4)], OKEY)).toBe(false);
  });
  it("is false when there are not enough wildcards to cover singletons", () => {
    // two distinct singletons (R7, B3) + Y9 single + one wildcard (okey) -> 3 singles, 1 wild -> false
    expect(
      isAllPairs([numbered("red", 7), numbered("blue", 3), numbered("black", 1), numbered("yellow", 9)], OKEY),
    ).toBe(false);
  });
});

describe("canOpenWithPairs", () => {
  const pair = (n: number): OkeyTile[] => [numbered("red", n), numbered("red", n)];
  it("requires at least minPairs (default 5) valid pairs", () => {
    expect(canOpenWithPairs([pair(2), pair(3), pair(4), pair(5)], OKEY)).toBe(false);
    expect(canOpenWithPairs([pair(2), pair(3), pair(4), pair(5), pair(6)], OKEY)).toBe(true);
  });
  it("honors a custom minPairs (katlamalı escalation in 1b)", () => {
    expect(canOpenWithPairs([pair(2), pair(3), pair(4), pair(5), pair(6)], OKEY, 6)).toBe(false);
  });
  it("rejects a group that is not a valid 2-tile pair", () => {
    const bad: OkeyTile[] = [numbered("red", 2), numbered("blue", 2)];
    expect(canOpenWithPairs([bad, pair(3), pair(4), pair(5), pair(6)], OKEY)).toBe(false);
  });
});
