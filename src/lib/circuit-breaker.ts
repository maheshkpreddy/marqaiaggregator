/**
 * Marq AI Aggregator — Circuit Breaker
 *
 * Tracks per-provider failure state in-memory so the failover engine can
 * skip providers that are currently "down" instead of wasting the full
 * request timeout on every call. Survives across requests within the same
 * serverless function instance (Vercel reuses warm instances for ~5-15min).
 *
 * States:
 *   CLOSED     — provider is healthy, all requests go through.
 *   OPEN       — provider has failed `FAILURE_THRESHOLD` consecutive times;
 *                requests skip it entirely until `COOLDOWN_MS` elapses.
 *   HALF_OPEN  — cooldown has elapsed; one probe request is allowed through.
 *                On success → CLOSED. On failure → OPEN again.
 *
 * Tunables (exported so tests / settings can override):
 *   FAILURE_THRESHOLD  = 3 consecutive failures
 *   COOLDOWN_MS        = 60 seconds
 *   SUCCESS_RESETS_AT  = 1 success while half-open resets the breaker
 */

export type BreakerStatus = "closed" | "open" | "half_open";

interface BreakerState {
  failures: number;       // consecutive failures (resets on any success)
  lastFailureAt: number;  // ms timestamp of most recent failure (0 if none)
  lastSuccessAt: number;  // ms timestamp of most recent success (0 if none)
  openUntil: number;      // ms timestamp when cooldown expires (0 if closed)
  status: BreakerStatus;
}

export const FAILURE_THRESHOLD = 3;
export const COOLDOWN_MS = 60_000; // 60 seconds

// Per-instance in-memory store. Keyed by providerId.
const store = new Map<string, BreakerState>();

function now(): number {
  return Date.now();
}

function getState(providerId: string): BreakerState {
  let s = store.get(providerId);
  if (!s) {
    s = {
      failures: 0,
      lastFailureAt: 0,
      lastSuccessAt: 0,
      openUntil: 0,
      status: "closed",
    };
    store.set(providerId, s);
  }
  return s;
}

/**
 * Should we attempt a call to this provider right now?
 *  - CLOSED → yes
 *  - OPEN + cooldown elapsed → yes (transitions to HALF_OPEN)
 *  - OPEN + cooldown NOT elapsed → no
 *  - HALF_OPEN → yes (this is the probe)
 */
export function shouldAttempt(providerId: string, at = now()): boolean {
  const s = getState(providerId);
  if (s.status === "closed") return true;
  if (s.status === "half_open") return true;
  // OPEN — check if cooldown has elapsed.
  if (at >= s.openUntil) {
    s.status = "half_open";
    return true;
  }
  return false;
}

/**
 * Record a successful call. Resets the breaker to CLOSED.
 */
export function recordSuccess(providerId: string, at = now()): void {
  const s = getState(providerId);
  s.failures = 0;
  s.lastSuccessAt = at;
  s.openUntil = 0;
  s.status = "closed";
}

/**
 * Record a failed call. After `FAILURE_THRESHOLD` consecutive failures,
 * the breaker transitions to OPEN for `COOLDOWN_MS`.
 */
export function recordFailure(providerId: string, at = now()): void {
  const s = getState(providerId);
  s.failures += 1;
  s.lastFailureAt = at;
  if (s.status === "half_open" || s.failures >= FAILURE_THRESHOLD) {
    s.status = "open";
    s.openUntil = at + COOLDOWN_MS;
  }
}

/**
 * Current status of a provider's breaker (for UI / debugging).
 */
export function getBreakerStatus(providerId: string, at = now()): BreakerStatus {
  const s = getState(providerId);
  // Lazily transition OPEN → HALF_OPEN if cooldown has elapsed.
  if (s.status === "open" && at >= s.openUntil) {
    s.status = "half_open";
  }
  return s.status;
}

/**
 * Snapshot of a breaker's internal state (for UI / debugging).
 */
export function getBreakerSnapshot(providerId: string, at = now()): {
  status: BreakerStatus;
  failures: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openUntil: number | null;
  cooldownRemainingMs: number;
} {
  const s = getState(providerId);
  // Lazy transition.
  if (s.status === "open" && at >= s.openUntil) {
    s.status = "half_open";
  }
  return {
    status: s.status,
    failures: s.failures,
    lastFailureAt: s.lastFailureAt || null,
    lastSuccessAt: s.lastSuccessAt || null,
    openUntil: s.openUntil || null,
    cooldownRemainingMs: s.status === "open" ? Math.max(0, s.openUntil - at) : 0,
  };
}

/**
 * Reset a breaker (e.g., after the user manually retries via the Providers tab).
 */
export function resetBreaker(providerId: string): void {
  store.delete(providerId);
}

/**
 * Reset all breakers (e.g., for tests).
 */
export function resetAllBreakers(): void {
  store.clear();
}

/**
 * Order providers so that OPEN-circuit ones go to the back. CLOSED and
 * HALF_OPEN providers stay at the front in their original relative order.
 *
 * This is used by the failover engine to attempt healthy providers first,
 * falling back to recently-failed ones only as a last resort.
 */
export function sortByBreakerStatus<T extends { id: string }>(
  providers: T[],
  at = now(),
): T[] {
  // Stable sort: preserves input order within each bucket.
  return providers.slice().sort((a, b) => {
    const aOpen = getBreakerStatus(a.id, at) === "open";
    const bOpen = getBreakerStatus(b.id, at) === "open";
    if (aOpen === bOpen) return 0;
    return aOpen ? 1 : -1;
  });
}
