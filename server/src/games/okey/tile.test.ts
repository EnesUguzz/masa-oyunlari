import { describe, it, expect } from "vitest";
import {
  numbered,
  fakeJoker,
  isNumbered,
  isFakeJoker,
  tilesEqual,
  OKEY_COLORS,
} from "./tile.js";

describe("tile", () => {
  it("constructs a numbered tile and narrows it", () => {
    const t = numbered("red", 5);
    expect(t).toEqual({ kind: "numbered", color: "red", value: 5 });
    expect(isNumbered(t)).toBe(true);
    expect(isFakeJoker(t)).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(() => numbered("red", 0)).toThrow();
    expect(() => numbered("red", 14)).toThrow();
    expect(() => numbered("red", 1.5)).toThrow();
  });

  it("constructs a fake joker", () => {
    const j = fakeJoker();
    expect(isFakeJoker(j)).toBe(true);
    expect(isNumbered(j)).toBe(false);
  });

  it("tilesEqual compares structurally; two fake jokers are equal", () => {
    expect(tilesEqual(numbered("red", 5), numbered("red", 5))).toBe(true);
    expect(tilesEqual(numbered("red", 5), numbered("blue", 5))).toBe(false);
    expect(tilesEqual(numbered("red", 5), numbered("red", 6))).toBe(false);
    expect(tilesEqual(fakeJoker(), fakeJoker())).toBe(true);
    expect(tilesEqual(fakeJoker(), numbered("red", 5))).toBe(false);
  });

  it("exposes the four colors", () => {
    expect(OKEY_COLORS).toEqual(["red", "yellow", "black", "blue"]);
  });
});
