import { describe, it, expect, vi } from "vitest";
import { TurnTimer } from "./turn-timer.js";
import { FakeClock } from "../clock.js";

describe("TurnTimer", () => {
  it("fires the timeout callback after the configured duration", () => {
    const clock = new FakeClock();
    const onTimeout = vi.fn();
    const timer = new TurnTimer(clock);
    timer.start(5000, onTimeout);
    clock.advance(4999);
    expect(onTimeout).not.toHaveBeenCalled();
    clock.advance(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("clear() cancels a pending timeout", () => {
    const clock = new FakeClock();
    const onTimeout = vi.fn();
    const timer = new TurnTimer(clock);
    timer.start(5000, onTimeout);
    timer.clear();
    clock.advance(10000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("starting again replaces the previous timeout", () => {
    const clock = new FakeClock();
    const first = vi.fn();
    const second = vi.fn();
    const timer = new TurnTimer(clock);
    timer.start(5000, first);
    timer.start(5000, second);
    clock.advance(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
