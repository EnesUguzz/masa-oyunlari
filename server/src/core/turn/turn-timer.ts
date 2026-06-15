import type { Clock, TimerHandle } from "../clock.js";

/**
 * Game-agnostic turn timeout. A game supplies the duration and what to do when
 * time runs out; core just counts. Not wired to any game in this slice.
 */
export class TurnTimer {
  private handle: TimerHandle | undefined;

  constructor(private readonly clock: Clock) {}

  start(durationMs: number, onTimeout: () => void): void {
    this.clear();
    this.handle = this.clock.setTimeout(() => {
      this.handle = undefined;
      onTimeout();
    }, durationMs);
  }

  clear(): void {
    if (this.handle !== undefined) {
      this.clock.clearTimeout(this.handle);
      this.handle = undefined;
    }
  }
}
