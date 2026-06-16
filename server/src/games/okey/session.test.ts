import { describe, expect, it } from "vitest";
import type { Player, PlayerId } from "@masa/shared";
import { SeededRng } from "../../core/rng.js";
import { makeConfig } from "./game-config.js";
import { OkeySession } from "./session.js";

function players(): Player[] {
  return [0, 1, 2, 3].map((i) => ({ id: `p${i}` as PlayerId, nickname: `N${i}` }));
}
const config = makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 7 });

function playToEnd(session: OkeySession): void {
  let guard = 0;
  while (!session.isOver && guard++ < 4000) {
    const seat = session.currentSeat;
    const before = session.handNo;
    session.apply(seat, { kind: "drawFromPile" });
    if (session.isOver || session.handNo !== before) continue;
    const view = session.tableViewFor(seat).view;
    const tile = view.yourHand[view.yourHand.length - 1]!;
    session.apply(seat, { kind: "discard", tile });
  }
}

describe("OkeySession", () => {
  it("initializes hand 1, seat 0 to move, with seat lookup and a per-seat view", () => {
    const s = new OkeySession(config, players(), new SeededRng(1));
    expect(s.handNo).toBe(1);
    expect(s.currentSeat).toBe(0);
    expect(s.isOver).toBe(false);
    expect(s.seatOf("p2" as PlayerId)).toBe(2);
    expect(s.seatOf("zzz" as PlayerId)).toBeNull();
    const tv = s.tableViewFor(0);
    expect(tv.view.you).toBe(0);
    expect(tv.view.yourHand.length).toBe(22);
    expect(tv.handNumber).toBe(1);
    expect(tv.seating.map((x) => x.nickname)).toEqual(["N0", "N1", "N2", "N3"]);
    expect(s.tableViewFor(1).view.players[0]!.handCount).toBe(22);
    expect((s.tableViewFor(1).view.players[0] as unknown as { hand?: unknown }).hand).toBeUndefined();
  });

  it("advances to the next hand after a hand finishes (exhaustion)", () => {
    const s = new OkeySession(config, players(), new SeededRng(1));
    let guard = 0;
    while (s.handNo === 1 && !s.isOver && guard++ < 200) {
      const sd = s.currentSeat;
      const b = s.handNo;
      s.apply(sd, { kind: "drawFromPile" });
      if (s.handNo !== b || s.isOver) break;
      const v = s.tableViewFor(sd).view;
      s.apply(sd, { kind: "discard", tile: v.yourHand[v.yourHand.length - 1]! });
    }
    expect(s.handNo).toBe(2);
    expect(s.isOver).toBe(false);
    expect(s.tableViewFor(0).view.status).toBe("playing");
  });

  it("finishes the match after targetHands and reports standings", () => {
    const s = new OkeySession(config, players(), new SeededRng(3));
    playToEnd(s);
    expect(s.isOver).toBe(true);
    const standing = s.tableViewFor(0).match;
    expect(standing.status).toBe("finished");
    expect(standing.handsPlayed).toBe(7);
    expect(standing.winner).toEqual({ kind: "seat", seat: 0 });
    expect(new Set(standing.seatTotals).size).toBe(1);
  });

  it("rejects an out-of-turn move without changing state", () => {
    const s = new OkeySession(config, players(), new SeededRng(1));
    expect(() => s.apply(1, { kind: "drawFromPile" })).toThrow();
    expect(s.currentSeat).toBe(0);
  });
});
