export interface AppConfig {
  port: number;
  gracePeriodMs: number;
  turnTimeoutMs: number;
  clientOrigin: string;
}

function num(name: string, value: string | undefined, fallback: number): number {
  // Treat empty/whitespace-only as absent: containerized deploys often produce
  // PORT="" from an unset interpolation, which Number() would turn into 0.
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for ${name}: "${value}" (expected a number)`);
  }
  return parsed;
}

/** Pure: reads from a provided env map so it is trivially testable. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return {
    port: num("PORT", env.PORT, 3001),
    gracePeriodMs: num("GRACE_PERIOD_MS", env.GRACE_PERIOD_MS, 30000),
    turnTimeoutMs: num("TURN_TIMEOUT_MS", env.TURN_TIMEOUT_MS, 60000),
    clientOrigin: env.CLIENT_ORIGIN ?? "http://localhost:5173",
  };
}
