import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";

const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"] as PlayerId[];

describe("applyMove draw phase", () => {
  it("drawFromPile moves one tile to the hand and enters act phase", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const s1 = applyMove(s0, { kind: "drawFromPile" }, 0);
    expect(s1.players[0]!.hand.length).toBe(23);
    expect(s1.drawPile.length).toBe(19);
    expect(s1.phase).toBe("act");
  });

  it("does not mutate the input state", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const before = JSON.stringify(s0);
    applyMove(s0, { kind: "drawFromPile" }, 0);
    expect(JSON.stringify(s0)).toBe(before);
  });

  it("rejects a move from the wrong seat", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    expect(() => applyMove(s0, { kind: "drawFromPile" }, 1)).toThrow();
  });

  it("rejects drawFromPile when not in draw phase", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const s1 = applyMove(s0, { kind: "drawFromPile" }, 0);
    expect(() => applyMove(s1, { kind: "drawFromPile" }, 0)).toThrow();
  });

  it("drawFromDiscard takes the previous seat's last discard and marks it pending", () => {
    let s = createHand(config, players, new SeededRng(1));
    s = applyMove(s, { kind: "drawFromPile" }, 0);
    const discarded = s.players[0]!.hand[0]!;
    s = applyMove(s, { kind: "discard", tile: discarded }, 0);
    expect(s.turn).toBe(1);
    const s2 = applyMove(s, { kind: "drawFromDiscard" }, 1);
    expect(s2.pendingFloorTile).not.toBeNull();
    expect(s2.players[1]!.hand.length).toBe(22);
    expect(s2.phase).toBe("act");
  });

  it("ends the hand by exhaustion when the draw pile is empty", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    const emptyPile = { ...s0, drawPile: [] };
    const s1 = applyMove(emptyPile, { kind: "drawFromPile" }, 0);
    expect(s1.status).toBe("finished");
    expect(s1.outcome?.deckExhausted).toBe(true);
    expect(s1.outcome?.finisherSeat).toBeNull();
  });
});
