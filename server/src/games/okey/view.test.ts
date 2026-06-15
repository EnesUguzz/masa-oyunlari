import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";
import { toOkeyPlayerView } from "./view.js";

const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 });
const players = ["p0", "p1", "p2", "p3"] as PlayerId[];

describe("toOkeyPlayerView", () => {
  it("reveals only the viewer's hand; others are counts only", () => {
    const s = createHand(config, players, new SeededRng(1));
    const v = toOkeyPlayerView(s, 0);
    expect(v.yourHand.length).toBe(22);
    expect(v.you).toBe(0);
    const me = v.players.find((p) => p.seat === 0)!;
    expect(me.handCount).toBe(22);
    expect((v.players[1] as unknown as { hand?: unknown }).hand).toBeUndefined();
    expect(v.players[1]!.handCount).toBe(21);
  });

  it("exposes only the draw pile COUNT, never its contents", () => {
    const s = createHand(config, players, new SeededRng(1));
    const v = toOkeyPlayerView(s, 2);
    expect(v.drawPileCount).toBe(20);
    expect((v as unknown as { drawPile?: unknown }).drawPile).toBeUndefined();
    expect(v.yourHand.length).toBe(21);
  });

  it("surfaces each player's last discard and the outcome only when finished", () => {
    let s = createHand(config, players, new SeededRng(1));
    s = applyMove(s, { kind: "drawFromPile" }, 0);
    const tile = s.players[0]!.hand[0]!;
    s = applyMove(s, { kind: "discard", tile }, 0);
    const v = toOkeyPlayerView(s, 1);
    expect(v.players[0]!.lastDiscard).not.toBeNull();
    expect(v.outcome).toBeNull();
    expect(v.turn).toBe(1);
  });
});
