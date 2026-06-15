import { describe, it, expect, vi } from "vitest";
import { FakeClock } from "./clock.js";

describe("FakeClock", () => {
  it("fires a scheduled callback after advancing past its delay", () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    clock.setTimeout(fn, 1000);
    clock.advance(999);
    expect(fn).not.toHaveBeenCalled();
    clock.advance(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clearTimeout prevents the callback from firing", () => {
    const clock = new FakeClock();
    const fn = vi.fn();
    const handle = clock.setTimeout(fn, 500);
    clock.clearTimeout(handle);
    clock.advance(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
