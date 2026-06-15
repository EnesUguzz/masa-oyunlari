import { describe, it, expect } from "vitest";
import { CryptoRng, SeededRng } from "./rng.js";

describe("Rng", () => {
  it("CryptoRng.nextInt returns values within [0, max)", () => {
    const rng = new CryptoRng();
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("SeededRng is deterministic for a given seed", () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    const seqA = [a.nextInt(1000), a.nextInt(1000), a.nextInt(1000)];
    const seqB = [b.nextInt(1000), b.nextInt(1000), b.nextInt(1000)];
    expect(seqA).toEqual(seqB);
  });
});
