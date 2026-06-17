import { describe, expect, it } from "vitest";
import type { NumberedTile, OkeyTile } from "./types.js";
import { isValidRun, isValidSet, isPair, classifyGroup, meldPoints, naturalValue } from "./meld-check.js";

const okey: NumberedTile = { kind: "numbered", color: "red", value: 13 };
const t = (color: "red" | "yellow" | "black" | "blue", value: number): NumberedTile => ({ kind: "numbered", color, value });
const fake: OkeyTile = { kind: "fakeJoker" };

describe("meld-check (client mirror)", () => {
  it("naturalValue: fake joker = okey-value tile; okey tile = wildcard (null)", () => {
    expect(naturalValue(fake, okey)).toEqual(t("red", 13));
    expect(naturalValue(t("red", 13), okey)).toBeNull();
    expect(naturalValue(t("blue", 4), okey)).toEqual(t("blue", 4));
  });

  it("valid run with the okey tile as wildcard; fake joker cannot fill a gap", () => {
    expect(isValidRun([t("red", 5), t("red", 13), t("red", 7)], okey)).toBe(true); // okey wild = 6
    expect(isValidRun([t("red", 5), fake, t("red", 7)], okey)).toBe(false); // fake = red 13, not 6
    expect(isValidRun([t("red", 5), t("red", 6), t("red", 7)], okey)).toBe(true);
  });

  it("valid set; fake joker only fits as the okey value", () => {
    expect(isValidSet([t("red", 7), t("yellow", 7), t("red", 13)], okey)).toBe(true); // okey wild
    expect(isValidSet([t("red", 7), t("yellow", 7), fake], okey)).toBe(false); // fake = 13 != 7
  });

  it("isPair: okey tile pairs with anything; fake joker pairs only with okey value", () => {
    expect(isPair(t("red", 13), t("blue", 4), okey)).toBe(true);
    expect(isPair(fake, t("blue", 4), okey)).toBe(false);
    expect(isPair(fake, fake, okey)).toBe(true);
  });

  it("classifyGroup labels run/set/pair/invalid", () => {
    expect(classifyGroup([t("red", 5), t("red", 6), t("red", 7)], okey, "melds")).toBe("run");
    expect(classifyGroup([t("red", 7), t("yellow", 7), t("black", 7)], okey, "melds")).toBe("set");
    expect(classifyGroup([t("red", 5), t("blue", 9)], okey, "melds")).toBe("invalid");
    expect(classifyGroup([t("red", 7), t("red", 7)], okey, "pairs")).toBe("pair");
    expect(classifyGroup([t("red", 7), t("blue", 7)], okey, "pairs")).toBe("invalid");
  });

  it("meldPoints sums represented values", () => {
    expect(meldPoints([t("red", 5), t("red", 6), t("red", 7)], okey)).toBe(18);
    expect(meldPoints([t("red", 6), t("red", 7), t("red", 13)], okey)).toBe(21); // wild as 8
    expect(meldPoints([t("red", 7), t("yellow", 7), t("red", 13)], okey)).toBe(21); // set 7*3
  });
});
