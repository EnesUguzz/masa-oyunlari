import { describe, expect, it } from "vitest";
import type { PlayerId } from "@masa/shared";
import { makeConfig } from "./game-config.js";
import { createMatch, applyHandScore } from "./match.js";
import type { HandScore } from "./scoring.js";

const players = ["p0", "p1", "p2", "p3"] as PlayerId[];
const essiz = makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 2 as 7 });
const esli = makeConfig({ pairing: "esli", escalation: "katlamasiz", targetHands: 2 as 7 });

const hs = (perSeat: number[], perTeam: [number, number] | null = null): HandScore => ({ perSeat, perTeam });

describe("match", () => {
  it("createMatch initializes totals and team buckets", () => {
    expect(createMatch(essiz, players).seatTotals).toEqual([0, 0, 0, 0]);
    expect(createMatch(essiz, players).teamTotals).toBeNull();
    expect(createMatch(esli, players).teamTotals).toEqual([0, 0]);
  });

  it("rejects a non-4 player list", () => {
    expect(() => createMatch(essiz, ["a", "b"] as PlayerId[])).toThrow();
  });

  it("accumulates per-seat scores and finishes after targetHands (essiz, lowest wins)", () => {
    let m = createMatch(essiz, players);
    m = applyHandScore(m, hs([-101, 20, 202, 5]));
    expect(m.status).toBe("playing");
    m = applyHandScore(m, hs([10, 10, 10, 10]));
    expect(m.status).toBe("finished");
    expect(m.seatTotals).toEqual([-91, 30, 212, 15]);
    expect(m.winner).toEqual({ kind: "seat", seat: 0 });
  });

  it("accumulates team totals and picks the lowest team (esli)", () => {
    let m = createMatch(esli, players);
    m = applyHandScore(m, hs([0, 9, 0, 202], [0, 211]));
    m = applyHandScore(m, hs([5, 5, 5, 5], [10, 10]));
    expect(m.status).toBe("finished");
    expect(m.teamTotals).toEqual([10, 221]);
    expect(m.winner).toEqual({ kind: "team", team: 0 });
  });

  it("rejects applying a score to a finished match", () => {
    let m = createMatch(essiz, players);
    m = applyHandScore(m, hs([1, 1, 1, 1]));
    m = applyHandScore(m, hs([1, 1, 1, 1]));
    expect(() => applyHandScore(m, hs([1, 1, 1, 1]))).toThrow();
  });
});
