export interface AppConfig {
  port: number;
  gracePeriodMs: number;
  turnTimeoutMs: number;
  clientOrigin: string;
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value but got "${value}"`);
  }
  return parsed;
}

/** Pure: reads from a provided env map so it is trivially testable. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return {
    port: num(env.PORT, 3001),
    gracePeriodMs: num(env.GRACE_PERIOD_MS, 30000),
    turnTimeoutMs: num(env.TURN_TIMEOUT_MS, 60000),
    clientOrigin: env.CLIENT_ORIGIN ?? "http://localhost:5173",
  };
}
