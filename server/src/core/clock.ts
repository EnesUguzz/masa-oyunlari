export type TimerHandle = number;

/** Injectable timer source so reconnect/turn-timeout logic is testable. */
export interface Clock {
  setTimeout(fn: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export class RealClock implements Clock {
  setTimeout(fn: () => void, delayMs: number): TimerHandle {
    return setTimeout(fn, delayMs) as unknown as TimerHandle;
  }
  clearTimeout(handle: TimerHandle): void {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
}

/** Deterministic clock: timers fire only when advance() crosses their deadline. */
export class FakeClock implements Clock {
  private now = 0;
  private nextHandle = 1;
  private timers = new Map<TimerHandle, { fireAt: number; fn: () => void }>();

  setTimeout(fn: () => void, delayMs: number): TimerHandle {
    const handle = this.nextHandle++;
    this.timers.set(handle, { fireAt: this.now + delayMs, fn });
    return handle;
  }

  clearTimeout(handle: TimerHandle): void {
    this.timers.delete(handle);
  }

  advance(ms: number): void {
    this.now += ms;
    for (const [handle, timer] of [...this.timers.entries()]) {
      if (timer.fireAt <= this.now) {
        this.timers.delete(handle);
        timer.fn();
      }
    }
  }
}
