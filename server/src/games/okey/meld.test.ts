import { describe, it, expect } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import { isValidRun, isValidSet, isValidMeld, meldRepresentedValues } from "./meld.js";

const OKEY = numbered("black", 1); // okey is black 1 -> wildcards: fake jokers + black 1

describe("isValidRun", () => {
  it("accepts a same-color consecutive run of length >= 3", () => {
    expect(isValidRun([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toBe(true);
    expect(isValidRun([numbered("red", 11), numbered("red", 12), numbered("red", 13)], OKEY)).toBe(true);
  });

  it("rejects wrap-around: 1 is low only, no 13-1 link", () => {
    expect(isValidRun([numbered("red", 12), numbered("red", 13), numbered("red", 1)], OKEY)).toBe(false);
    expect(
      isValidRun([numbered("red", 11), numbered("red", 12), numbered("red", 13), numbered("red", 1)], OKEY),
    ).toBe(false);
    expect(isValidRun([numbered("red", 13), numbered("red", 1), numbered("red", 2)], OKEY)).toBe(false);
  });

  it("rejects mixed colors, duplicates, and length < 3", () => {
    expect(isValidRun([numbered("red", 5), numbered("blue", 6), numbered("red", 7)], OKEY)).toBe(false);
    expect(isValidRun([numbered("red", 5), numbered("red", 5), numbered("red", 6)], OKEY)).toBe(false);
    expect(isValidRun([numbered("red", 5), numbered("red", 6)], OKEY)).toBe(false);
  });

  it("fills gaps and ends with the wildcard (the okey tile)", () => {
    expect(isValidRun([numbered("red", 5), numbered("black", 1), numbered("red", 7)], OKEY)).toBe(true); // black 1 (okey) = 6
    expect(isValidRun([numbered("red", 5), numbered("red", 6), numbered("black", 1)], OKEY)).toBe(true); // black 1 (okey) = 7
  });

  it("treats the fake joker as the concrete okey-value tile, not a wildcard", () => {
    // OKEY = black 1, so a fake joker is exactly a black 1: it only fits where black 1 fits.
    expect(isValidRun([fakeJoker(), numbered("black", 2), numbered("black", 3)], OKEY)).toBe(true); // black 1-2-3
    expect(isValidRun([numbered("red", 5), fakeJoker(), numbered("red", 7)], OKEY)).toBe(false); // black 1 cannot be the "6"
  });

  it("rejects a run made entirely of wildcards", () => {
    expect(isValidRun([numbered("black", 1), numbered("black", 1), numbered("black", 1)], OKEY)).toBe(false);
  });
});

describe("isValidSet", () => {
  it("accepts same-number distinct-color sets of size 3 or 4", () => {
    expect(isValidSet([numbered("red", 7), numbered("yellow", 7), numbered("black", 7)], OKEY)).toBe(true);
    expect(
      isValidSet(
        [numbered("red", 7), numbered("yellow", 7), numbered("black", 7), numbered("blue", 7)],
        OKEY,
      ),
    ).toBe(true);
  });

  it("rejects duplicate colors, mixed numbers, and size > 4", () => {
    expect(isValidSet([numbered("red", 7), numbered("red", 7), numbered("yellow", 7)], OKEY)).toBe(false);
    expect(isValidSet([numbered("red", 7), numbered("yellow", 8), numbered("black", 7)], OKEY)).toBe(false);
    expect(
      isValidSet(
        [numbered("red", 7), numbered("yellow", 7), numbered("black", 7), numbered("blue", 7), numbered("black", 1)],
        OKEY,
      ),
    ).toBe(false);
  });

  it("fills a missing color with a wildcard (the okey tile)", () => {
    expect(isValidSet([numbered("red", 7), numbered("yellow", 7), numbered("black", 1)], OKEY)).toBe(true);
  });
});

describe("meldRepresentedValues", () => {
  it("returns the represented value multiset for a plain run", () => {
    expect(meldRepresentedValues([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toEqual([5, 6, 7]);
  });

  it("forces a wildcard to the gap value", () => {
    expect(meldRepresentedValues([numbered("red", 5), numbered("black", 1), numbered("red", 7)], OKEY)).toEqual([5, 6, 7]);
  });

  it("places trailing wildcards at the highest feasible values (max sum)", () => {
    expect(meldRepresentedValues([numbered("red", 6), numbered("red", 7), numbered("black", 1)], OKEY)).toEqual([6, 7, 8]);
  });

  it("values a set at its common number", () => {
    expect(meldRepresentedValues([numbered("red", 7), numbered("yellow", 7), numbered("black", 1)], OKEY)).toEqual([7, 7, 7]);
  });

  it("returns null for an invalid meld", () => {
    expect(meldRepresentedValues([numbered("red", 5), numbered("blue", 9)], OKEY)).toBeNull();
  });
});

describe("isValidMeld", () => {
  it("is true for a valid run or set, false otherwise", () => {
    expect(isValidMeld([numbered("red", 5), numbered("red", 6), numbered("red", 7)], OKEY)).toBe(true);
    expect(isValidMeld([numbered("red", 7), numbered("yellow", 7), numbered("black", 7)], OKEY)).toBe(true);
    expect(isValidMeld([numbered("red", 5), numbered("blue", 9)], OKEY)).toBe(false);
  });
});
