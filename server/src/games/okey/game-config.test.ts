import { describe, expect, it } from "vitest";
import { makeConfig, DEFAULT_OPEN_THRESHOLD, DEFAULT_MIN_PAIRS } from "./game-config.js";

describe("makeConfig", () => {
  it("fills defaults for threshold and pairs", () => {
    const c = makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 });
    expect(c.openThreshold).toBe(DEFAULT_OPEN_THRESHOLD);
    expect(c.minPairs).toBe(DEFAULT_MIN_PAIRS);
    expect(c.pairing).toBe("essiz");
    expect(c.targetHands).toBe(11);
  });

  it("respects overrides", () => {
    const c = makeConfig({ pairing: "esli", escalation: "katlamali", targetHands: 21, openThreshold: 51, minPairs: 6 });
    expect(c.openThreshold).toBe(51);
    expect(c.minPairs).toBe(6);
  });

  it("defaults partnerEscalation to ese-katlamali and respects overrides", () => {
    const a = makeConfig({ pairing: "esli", escalation: "katlamali", targetHands: 11 });
    expect(a.partnerEscalation).toBe("ese-katlamali");
    const b = makeConfig({ pairing: "esli", escalation: "katlamali", targetHands: 11, partnerEscalation: "ese-katlamasiz" });
    expect(b.partnerEscalation).toBe("ese-katlamasiz");
  });
});
