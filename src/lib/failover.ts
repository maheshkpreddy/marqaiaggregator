/**
 * Marq AI Aggregator — Failover Engine
 *
 * Given a list of providers in priority order, tries each one until a
 * successful response is returned. On failure:
 *   1. Classifies the error.
 *   2. Logs the failure to HealthLog + FailoverLog (DB).
 *   3. Records the failure in the in-memory circuit breaker so the next
 *      request can skip this provider for `COOLDOWN_MS` instead of waiting
 *      the full timeout again.
 *   4. Moves to the next provider.
 *
 * Additionally, providers are re-ordered by circuit-breaker status before
 * the loop runs: OPEN providers (recently failing) are sent to the back so
 * the request prefers healthy providers first.
 *
 * ULTIMATE FALLBACK: If every configured provider fails, the engine falls
 * back to a guaranteed demo-mode response from the original primary so the
 * user ALWAYS gets an answer instead of a 502 error. The result is tagged
 * with `failedOver=true, fallback=true` so the UI can show a warning.
 */

import { db } from "@/lib/db";
import type { Provider, ChatMessage } from "@/lib/providers";
import {
  callProvider,
  classifyError,
  hasEffectiveApiKey,
  demoModeCall,
  ProviderError,
  type ProviderChatRequest,
  type ProviderChatResult,
  type FailoverReason,
} from "@/lib/providers";
import {
  shouldAttempt,
  recordSuccess,
  recordFailure,
  sortByBreakerStatus,
} from "@/lib/circuit-breaker";

export interface FailoverAttempt {
  providerId: string;
  providerName: string;
  success: boolean;
  reason?: FailoverReason | "circuit_open" | "no_api_key";
  errorMessage?: string;
  latencyMs?: number;
  skipped?: boolean; // true if skipped due to open circuit breaker OR no API key
}

export interface FailoverOutcome {
  result: ProviderChatResult;
  attempts: FailoverAttempt[];
  finalProviderId: string;
  finalProviderName: string;
  failedOver: boolean;
  originalProviderId: string;
  /** True if the response came from the ultimate demo fallback (all real providers failed). */
  fallback?: boolean;
}

export interface FailoverOptions {
  /** Ordered list of providers to try. Index 0 is primary. */
  providers: Provider[];
  messages: ChatMessage[];
  model?: string;
  sessionId?: string;
  signal?: AbortSignal;
  /** Per-provider timeout in ms (default 15s). */
  timeoutMs?: number;
  /**
   * If true (default), the engine falls back to a guaranteed demo-mode
   * response when all real providers fail. Set to false to get the original
   * 502-on-total-failure behavior (used by the comparison endpoint where we
   * want to surface real failures).
   */
  enableDemoFallback?: boolean;
}

/**
 * Run the failover loop. Always tries providers in the given priority order
 * (after circuit-breaker re-ordering). Returns the first successful response
 * and a structured log of every attempt.
 *
 * If every provider fails AND `enableDemoFallback` is true (default), the
 * engine synthesizes a guaranteed demo-mode response so the user always gets
 * an answer — the UI can show a banner explaining the response is a fallback.
 */
export async function runWithFailover(opts: FailoverOptions): Promise<FailoverOutcome> {
  const {
    providers,
    messages,
    model,
    sessionId,
    signal,
    timeoutMs = 15000,
    enableDemoFallback = true,
  } = opts;

  if (providers.length === 0) {
    throw new Error("No providers configured for failover.");
  }

  const originalProviderId = providers[0].id;

  // Re-order providers: push OPEN-circuit providers to the back so we try
  // healthy ones first. CLOSED / HALF_OPEN keep their relative order.
  // The originally-pinned primary stays first if its breaker is not open.
  const orderedProviders = sortByBreakerStatus(providers);

  const attempts: FailoverAttempt[] = [];
  let outcome: FailoverOutcome | null = null;

  for (let i = 0; i < orderedProviders.length; i++) {
    const provider = orderedProviders[i];
    const attempt: FailoverAttempt = {
      providerId: provider.id,
      providerName: provider.displayName,
      success: false,
    };

    // Circuit-breaker skip: if the breaker is OPEN and we haven't reached
    // cooldown yet, skip this provider entirely. We still record an attempt
    // entry so the UI / logs can show "skipped (circuit open)".
    if (!shouldAttempt(provider.id)) {
      attempt.skipped = true;
      attempt.reason = "circuit_open";
      attempt.errorMessage = `Circuit breaker open — skipping ${provider.displayName} for now.`;
      attempts.push(attempt);
      continue;
    }

    // No-API-key skip: if this provider has no real API key (neither in the
    // DB nor in env vars), skip it instead of falling into demo mode. This
    // is critical because demo mode ALWAYS succeeds, which would mask any
    // live providers further down the priority list. By skipping demo-only
    // providers here, the failover engine moves on to providers that CAN
    // return real responses. If ALL providers are demo-only, the ultimate
    // demo fallback at the bottom of this function kicks in.
    if (!hasEffectiveApiKey(provider)) {
      attempt.skipped = true;
      attempt.reason = "no_api_key";
      attempt.errorMessage = `No API key configured for ${provider.displayName} — skipping (demo mode).`;
      attempts.push(attempt);
      continue;
    }

    try {
      const req: ProviderChatRequest = {
        messages,
        model: model || defaultModel(provider),
        signal,
      };

      const result = await withTimeout(
        callProvider(provider, req),
        timeoutMs,
        provider.displayName,
      );

      attempt.success = true;
      attempt.latencyMs = result.latencyMs;
      attempts.push(attempt);

      // Tell the breaker this provider is healthy.
      recordSuccess(provider.id);

      // Record health log for the successful provider.
      await db.healthLog.create({
        data: {
          providerId: provider.id,
          status: "healthy",
          latencyMs: result.latencyMs,
        },
      }).catch(() => {/* ignore db logging errors */});

      outcome = {
        result,
        attempts,
        finalProviderId: provider.id,
        finalProviderName: provider.displayName,
        // "failedOver" should mean a real provider was attempted and failed,
        // NOT that a demo-only provider was silently skipped. Skipping a
        // provider with no API key is normal auto-selection, not a failure
        // event — so we only flag failover when the original primary was
        // actually ATTEMPTED (not skipped) and didn't produce this result.
        failedOver: provider.id !== originalProviderId &&
          attempts.some((a) => a.providerId === originalProviderId && !a.success && !a.skipped),
        originalProviderId,
      };
      break;
    } catch (err) {
      const reason = err instanceof ProviderError ? err.reason : classifyError(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      attempt.success = false;
      attempt.reason = reason;
      attempt.errorMessage = errorMessage;
      attempts.push(attempt);

      // Tell the breaker this provider failed (it may transition to OPEN).
      recordFailure(provider.id);

      // Record health log for the failed provider.
      await db.healthLog.create({
        data: {
          providerId: provider.id,
          status: reason === "timeout" || reason === "network" ? "degraded" : "down",
          error: errorMessage.slice(0, 500),
        },
      }).catch(() => {/* ignore db logging errors */});

      // If this provider failed AND there's another provider to try,
      // record the failover transition: provider[i] → provider[i+1].
      if (i < orderedProviders.length - 1) {
        // Find the next provider we'll actually attempt — skip both
        // open-circuit providers AND providers with no API key (both
        // are guaranteed to be skipped at the top of the next loop).
        let nextIdx = i + 1;
        while (nextIdx < orderedProviders.length &&
               (!shouldAttempt(orderedProviders[nextIdx].id) ||
                !hasEffectiveApiKey(orderedProviders[nextIdx]))) {
          nextIdx++;
        }
        if (nextIdx < orderedProviders.length) {
          const nextProvider = orderedProviders[nextIdx];
          await db.failoverLog.create({
            data: {
              fromProviderId: provider.id,
              toProviderId: nextProvider.id,
              reason,
              errorMessage: errorMessage.slice(0, 500),
              sessionId: sessionId ?? null,
            },
          }).catch(() => {/* ignore db logging errors */});
        }
      }
      // Continue to next iteration — try the next provider.
    }
  }

  // No provider succeeded. Fall back to demo mode for the original primary
  // so the user ALWAYS gets an answer. Mark the result clearly so the UI can
  // show a warning ("All live providers failed — showing fallback response").
  if (!outcome && enableDemoFallback) {
    const fallbackProvider = orderedProviders.find((p) => p.id === originalProviderId)
      ?? orderedProviders[0];

    try {
      const fallbackResult = await synthesizeDemoFallback(
        fallbackProvider,
        messages,
        model,
        attempts,
      );

      // Log that we used the ultimate fallback (best-effort).
      await db.healthLog.create({
        data: {
          providerId: fallbackProvider.id,
          status: "degraded",
          error: `Ultimate fallback used: all ${attempts.filter(a => !a.skipped).length} attempted providers failed.`,
        },
      }).catch(() => {/* ignore db logging errors */});

      outcome = {
        result: fallbackResult,
        attempts,
        finalProviderId: fallbackProvider.id,
        finalProviderName: fallbackProvider.displayName,
        failedOver: true,
        originalProviderId,
        fallback: true,
      };
    } catch (err) {
      // Even the fallback failed — this should never happen, but bail out.
      throw new Error(
        `All ${orderedProviders.length} providers failed AND the demo fallback crashed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (!outcome) {
    throw new Error(
      `All ${orderedProviders.length} providers failed. Last error: ${attempts[attempts.length - 1]?.errorMessage ?? "unknown"}`,
    );
  }

  return outcome;
}

/**
 * Synthesize a guaranteed demo-mode response when every real provider has
 * failed. Re-uses the same demo generator as the providers module (so the
 * response looks native to the chosen provider) but prefixes a small banner
 * explaining this is a fallback.
 *
 * IMPORTANT: We call demoModeCall DIRECTLY here (not callProvider) because
 * callProvider re-routes marq_glm/zai to callZaiGlm() whenever ZAI_TOKEN is
 * set as an env var — even if the provider's apiKey is stripped. That would
 * re-trigger the failing network call instead of producing a guaranteed
 * demo response. demoModeCall makes no network calls and always succeeds,
 * which is the whole point of an "ultimate fallback".
 */
async function synthesizeDemoFallback(
  provider: Provider,
  messages: ChatMessage[],
  model: string | undefined,
  attempts: FailoverAttempt[],
): Promise<ProviderChatResult> {
  const req: ProviderChatRequest = {
    messages,
    model: model || defaultModel(provider),
  };

  const start = Date.now();
  const result = await demoModeCall(provider, req, start);

  // Prepend a fallback banner so the user knows why they're seeing this.
  // Count both failed AND skipped attempts (e.g. all providers had no API
  // key) so the banner is accurate in the all-demo-only case.
  const unavailableNames = attempts
    .filter((a) => !a.success)
    .map((a) => a.providerName)
    .slice(0, 3);
  const unavailableCount = attempts.filter((a) => !a.success).length;
  const banner = [
    `> ⚠️ **Live fallback triggered** — ${unavailableCount} provider(s) unavailable (${unavailableNames.join(", ")}).`,
    `> Showing a simulated response so you still get an answer. Add a real API key in the **Providers** tab or via env vars to get live responses.`,
    ``,
  ].join("\n");

  return {
    ...result,
    content: banner + result.content,
    latencyMs: Date.now() - start,
  };
}

function defaultModel(provider: Provider): string {
  try {
    const models = JSON.parse(provider.models) as string[];
    return models[0] ?? "default";
  } catch {
    return "default";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderError("timeout", `${label} did not respond within ${ms}ms`, label));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
