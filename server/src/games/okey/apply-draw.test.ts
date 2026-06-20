import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";

const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"] as PlayerId[];

// Seat 0 opens the hand in "act" (it holds 22 and discards first, without drawing).
// To exercise the draw mechanics we advance to seat 1's turn, which is a real draw turn.
function drawTurn(seed: number) {
  const s0 = createHand(config, players, new SeededRng(seed));
  const s1 = applyMove(s0, { kind: "discard", tile: s0.players[0]!.hand[0]! }, 0);
  // turn === 1, phase === "draw", seat 1 holds 21 tiles, seat 0 has one discard
  return s1;
}

describe("applyMove draw phase", () => {
  it("drawFromPile moves one tile to the hand and enters act phase", () => {
    const s1 = applyMove(drawTurn(1), { kind: "drawFromPile" }, 1);
    expect(s1.players[1]!.hand.length).toBe(22);
    expect(s1.drawPile.length).toBe(19);
    expect(s1.phase).toBe("act");
  });

  it("does not mutate the input state", () => {
    const s = drawTurn(1);
    const before = JSON.stringify(s);
    applyMove(s, { kind: "drawFromPile" }, 1);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("rejects a move from the wrong seat", () => {
    const s = drawTurn(1);
    expect(() => applyMove(s, { kind: "drawFromPile" }, 0)).toThrow();
  });

  it("rejects drawFromPile when not in draw phase", () => {
    const s1 = applyMove(drawTurn(1), { kind: "drawFromPile" }, 1);
    expect(() => applyMove(s1, { kind: "drawFromPile" }, 1)).toThrow();
  });

  it("the starting seat cannot draw (it opens in act phase)", () => {
    const s0 = createHand(config, players, new SeededRng(1));
    expect(s0.phase).toBe("act");
    expect(() => applyMove(s0, { kind: "drawFromPile" }, 0)).toThrow();
  });

  it("drawFromDiscard takes the previous seat's last discard and marks it pending", () => {
    const s = drawTurn(1);
    expect(s.turn).toBe(1);
    const s2 = applyMove(s, { kind: "drawFromDiscard" }, 1);
    expect(s2.pendingFloorTile).not.toBeNull();
    expect(s2.players[1]!.hand.length).toBe(22);
    expect(s2.phase).toBe("act");
  });

  it("ends the hand by exhaustion when the draw pile is empty", () => {
    const emptyPile = { ...drawTurn(1), drawPile: [] };
    const s1 = applyMove(emptyPile, { kind: "drawFromPile" }, 1);
    expect(s1.status).toBe("finished");
    expect(s1.outcome?.deckExhausted).toBe(true);
    expect(s1.outcome?.finisherSeat).toBeNull();
  });
});
