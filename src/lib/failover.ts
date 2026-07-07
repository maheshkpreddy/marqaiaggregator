/**
 * Marq AI Aggregator - Failover Engine
 *
 * Given a list of providers in priority order, tries each one until a
 * successful response is returned. On failure, classifies the error,
 * logs the failover, and moves to the next provider.
 */

import { db } from "@/lib/db";
import type { Provider, ChatMessage } from "@/lib/providers";
import {
  callProvider,
  classifyError,
  ProviderError,
  type ProviderChatRequest,
  type ProviderChatResult,
  type FailoverReason,
} from "@/lib/providers";

export interface FailoverAttempt {
  providerId: string;
  providerName: string;
  success: boolean;
  reason?: FailoverReason;
  errorMessage?: string;
  latencyMs?: number;
}

export interface FailoverOutcome {
  result: ProviderChatResult;
  attempts: FailoverAttempt[];
  finalProviderId: string;
  finalProviderName: string;
  failedOver: boolean;
  originalProviderId: string;
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
}

/**
 * Run the failover loop. Always tries providers in the given priority order.
 * Returns the first successful response and a structured log of every attempt.
 */
export async function runWithFailover(opts: FailoverOptions): Promise<FailoverOutcome> {
  const { providers, messages, model, sessionId, signal, timeoutMs = 15000 } = opts;

  if (providers.length === 0) {
    throw new Error("No providers configured for failover.");
  }

  const attempts: FailoverAttempt[] = [];
  const originalProviderId = providers[0].id;
  let outcome: FailoverOutcome | null = null;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const attempt: FailoverAttempt = {
      providerId: provider.id,
      providerName: provider.displayName,
      success: false,
    };

    try {
      const req: ProviderChatRequest = {
        messages,
        model: model || defaultModel(provider),
        signal,
      };

      // Race the call against a timeout for this attempt.
      const result = await withTimeout(
        callProvider(provider, req),
        timeoutMs,
        provider.displayName,
      );

      attempt.success = true;
      attempt.latencyMs = result.latencyMs;
      attempts.push(attempt);

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
        failedOver: i > 0,
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
      if (i < providers.length - 1) {
        const nextProvider = providers[i + 1];
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

      // Auth errors usually mean the key is bad — we can still try the next provider.
      // Continue to next iteration.
    }
  }

  if (!outcome) {
    throw new Error(
      `All ${providers.length} providers failed. Last error: ${attempts[attempts.length - 1]?.errorMessage ?? "unknown"}`,
    );
  }

  return outcome;
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
