import { describe, expect, it } from "vitest";
import type { Move } from "./move.js";
import { moveSchema, startGameSchema, okeyMoveSchema, type OkeyMovePayload } from "./contract.js";

type Assert<T extends true> = T;
type _safe = Assert<OkeyMovePayload extends Move ? true : false>;
const _check: _safe = true;
void _check;

describe("okey contract", () => {
  it("accepts each valid move kind", () => {
    expect(moveSchema.parse({ kind: "drawFromPile" }).kind).toBe("drawFromPile");
    expect(moveSchema.parse({ kind: "discard", tile: { kind: "fakeJoker" } }).kind).toBe("discard");
    expect(moveSchema.parse({ kind: "openMelds", melds: [[{ kind: "numbered", color: "red", value: 5 }]] }).kind).toBe("openMelds");
  });
  it("rejects malformed moves and tiles", () => {
    expect(() => moveSchema.parse({ kind: "nope" })).toThrow();
    expect(() => moveSchema.parse({ kind: "discard", tile: { kind: "numbered", color: "pink", value: 5 } })).toThrow();
    expect(() => moveSchema.parse({ kind: "discard", tile: { kind: "numbered", color: "red", value: 14 } })).toThrow();
    expect(() => moveSchema.parse({ kind: "drawFromPile", extra: 1 })).toThrow();
  });
  it("validates startGame config and the move envelope", () => {
    const cfg = startGameSchema.parse({ pairing: "esli", escalation: "katlamali", penalty: "cezali", targetHands: 11 });
    expect(cfg.targetHands).toBe(11);
    expect(() => startGameSchema.parse({ pairing: "x", escalation: "katlamali", penalty: "cezali", targetHands: 11 })).toThrow();
    expect(okeyMoveSchema.parse({ move: { kind: "drawFromPile" } }).move.kind).toBe("drawFromPile");
  });
});
