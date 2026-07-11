import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

/**
 * GET /api/ai-dashboard
 *
 * Returns aggregated analytics for the AI Health Analytics Dashboard:
 *  - Per-provider stats: total requests, success rate, avg latency, p95 latency,
 *    last 24h request count, last 24h failure count
 *  - Time series of latency over last 24h (bucketed by hour)
 *  - Time series of request volume over last 24h (bucketed by hour)
 *  - Currently running agent tasks
 *  - Top failover transitions (from → to → count)
 *  - Token usage by provider (last 24h)
 *
 * Admin-only: requires `admin` or `owner` role.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx || (ctx.role !== "admin" && ctx.role !== "owner")) {
    return NextResponse.json(
      { error: "Admin access required for the AI Health Analytics Dashboard." },
      { status: 403 },
    );
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── 1. Per-provider aggregate stats (last 7 days for statistical relevance) ──
  const providers = await db.provider.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: {
      healthLogs: {
        where: { checkedAt: { gte: sevenDaysAgo } },
        orderBy: { checkedAt: "asc" },
        select: { id: true, status: true, latencyMs: true, error: true, checkedAt: true },
      },
      _count: { select: { messages: true, agentSteps: true, failoversFrom: true, failoversTo: true } },
    },
  });

  const providerStats = providers.map((p) => {
    const logs = p.healthLogs;
    const totalChecks = logs.length;
    const healthyChecks = logs.filter((l) => l.status === "healthy").length;
    const downChecks = logs.filter((l) => l.status === "down").length;
    const degradedChecks = logs.filter((l) => l.status === "degraded").length;
    const successRate = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100;
    const latencies = logs
      .filter((l) => l.latencyMs != null)
      .map((l) => l.latencyMs as number)
      .sort((a, b) => a - b);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
      : null;
    const p95Latency = latencies.length > 0
      ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
      : null;
    const last24hChecks = logs.filter((l) => l.checkedAt >= twentyFourHoursAgo).length;
    const last24hFailures = logs.filter((l) => l.checkedAt >= twentyFourHoursAgo && l.status !== "healthy").length;
    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      color: p.color,
      icon: p.icon,
      active: p.active,
      priority: p.priority,
      hasApiKey: !!(p.apiKey) || p.name === "marq_free",
      totalChecks,
      healthyChecks,
      downChecks,
      degradedChecks,
      successRate: Math.round(successRate * 10) / 10,
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      last24hChecks,
      last24hFailures,
      messageCount: p._count.messages,
      agentStepCount: p._count.agentSteps,
      failoversFromCount: p._count.failoversFrom,
      failoversToCount: p._count.failoversTo,
      lastError: logs.find((l) => l.error)?.error ?? null,
      lastCheckedAt: logs.length > 0 ? logs[logs.length - 1].checkedAt : null,
    };
  });

  // ── 2. Latency time series (last 24h, hourly buckets) ──
  const latencySeries: Array<Record<string, number | string>> = [];
  for (let h = 23; h >= 0; h--) {
    const bucketStart = new Date(now.getTime() - h * 60 * 60 * 1000);
    const bucketEnd = new Date(now.getTime() - (h - 1) * 60 * 60 * 1000);
    const bucketLabel = bucketStart.toISOString().slice(0, 16);
    const bucket: Record<string, number | string> = { time: bucketLabel, hour: `${bucketStart.getHours()}:00` };
    for (const p of providers) {
      const inBucket = p.healthLogs.filter(
        (l) => l.checkedAt >= bucketStart && l.checkedAt < bucketEnd && l.latencyMs != null,
      );
      if (inBucket.length > 0) {
        bucket[p.name] = Math.round(
          inBucket.reduce((s, l) => s + (l.latencyMs ?? 0), 0) / inBucket.length,
        );
      }
    }
    latencySeries.push(bucket);
  }

  // ── 3. Request volume time series (last 24h, hourly buckets) ──
  const volumeSeries: Array<{ time: string; hour: string; healthy: number; degraded: number; down: number; total: number }> = [];
  for (let h = 23; h >= 0; h--) {
    const bucketStart = new Date(now.getTime() - h * 60 * 60 * 1000);
    const bucketEnd = new Date(now.getTime() - (h - 1) * 60 * 60 * 1000);
    const bucketLabel = bucketStart.toISOString().slice(0, 16);
    let healthy = 0, degraded = 0, down = 0;
    for (const p of providers) {
      for (const l of p.healthLogs) {
        if (l.checkedAt >= bucketStart && l.checkedAt < bucketEnd) {
          if (l.status === "healthy") healthy++;
          else if (l.status === "degraded") degraded++;
          else if (l.status === "down") down++;
        }
      }
    }
    volumeSeries.push({
      time: bucketLabel,
      hour: `${bucketStart.getHours()}:00`,
      healthy,
      degraded,
      down,
      total: healthy + degraded + down,
    });
  }

  // ── 4. Currently running agent tasks ──
  const runningTasks = await db.agentTask.findMany({
    where: { status: "running" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      goal: true,
      agentType: true,
      status: true,
      primaryProviderId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { steps: true } },
    },
  });
  const runningTaskProviderIds = [...new Set(runningTasks.map((t) => t.primaryProviderId).filter(Boolean))] as string[];
  const runningTaskProviders = await db.provider.findMany({
    where: { id: { in: runningTaskProviderIds } },
    select: { id: true, name: true, displayName: true, color: true, icon: true },
  });
  const runningTasksEnriched = runningTasks.map((t) => ({
    ...t,
    primaryProvider: runningTaskProviders.find((p) => p.id === t.primaryProviderId) ?? null,
    stepCount: t._count.steps,
  }));

  // ── 5. Top failover transitions (last 7 days) ──
  const failoverLogs = await db.failoverLog.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    include: {
      fromProvider: { select: { id: true, name: true, displayName: true, color: true } },
      toProvider: { select: { id: true, name: true, displayName: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const transitionMap = new Map<string, { from: string; to: string; fromName: string; toName: string; fromColor: string; toColor: string; count: number; reasons: Record<string, number> }>();
  for (const f of failoverLogs) {
    const key = `${f.fromProvider.id}→${f.toProvider.id}`;
    const existing = transitionMap.get(key);
    if (existing) {
      existing.count++;
      existing.reasons[f.reason] = (existing.reasons[f.reason] ?? 0) + 1;
    } else {
      transitionMap.set(key, {
        from: f.fromProvider.id,
        to: f.toProvider.id,
        fromName: f.fromProvider.displayName,
        toName: f.toProvider.displayName,
        fromColor: f.fromProvider.color,
        toColor: f.toProvider.color,
        count: 1,
        reasons: { [f.reason]: 1 },
      });
    }
  }
  const topTransitions = [...transitionMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  // ── 6. Token usage by provider (last 24h, from Message) ──
  const recentMessages = await db.message.findMany({
    where: { createdAt: { gte: twentyFourHoursAgo }, providerId: { not: null } },
    select: { providerId: true, tokensUsed: true, latencyMs: true },
  });
  const tokenByProvider = new Map<string, { tokens: number; requests: number; latencySum: number }>();
  for (const m of recentMessages) {
    if (!m.providerId) continue;
    const existing = tokenByProvider.get(m.providerId);
    if (existing) {
      existing.tokens += m.tokensUsed ?? 0;
      existing.requests++;
      existing.latencySum += m.latencyMs ?? 0;
    } else {
      tokenByProvider.set(m.providerId, {
        tokens: m.tokensUsed ?? 0,
        requests: 1,
        latencySum: m.latencyMs ?? 0,
      });
    }
  }
  const tokenUsage = [...tokenByProvider.entries()]
    .map(([providerId, stats]) => {
      const provider = providers.find((p) => p.id === providerId);
      return {
        providerId,
        providerName: provider?.displayName ?? "Unknown",
        providerColor: provider?.color ?? "#94a3b8",
        tokens: stats.tokens,
        requests: stats.requests,
        avgLatencyMs: stats.requests > 0 ? Math.round(stats.latencySum / stats.requests) : 0,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  // ── 7. Aggregate KPIs ──
  const totalProviders = providers.length;
  const activeProviders = providers.filter((p) => p.active).length;
  const healthyProviders = providerStats.filter((p) => p.successRate >= 95).length;
  const degradedProviders = providerStats.filter((p) => p.successRate >= 50 && p.successRate < 95).length;
  const downProviders = providerStats.filter((p) => p.successRate < 50).length;
  const totalRequests7d = providerStats.reduce((s, p) => s + p.totalChecks, 0);
  const totalFailures7d = providerStats.reduce((s, p) => s + p.downChecks + p.degradedChecks, 0);
  const overallSuccessRate = totalRequests7d > 0
    ? Math.round(((totalRequests7d - totalFailures7d) / totalRequests7d) * 1000) / 10
    : 100;
  const totalTokens24h = tokenUsage.reduce((s, t) => s + t.tokens, 0);
  const totalFailovers7d = failoverLogs.length;
  const avgLatencyOverall = (() => {
    const allLatencies = providerStats
      .filter((p) => p.avgLatencyMs != null)
      .map((p) => p.avgLatencyMs as number);
    return allLatencies.length > 0
      ? Math.round(allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length)
      : null;
  })();

  return NextResponse.json({
    generatedAt: now.toISOString(),
    window: { last24h: twentyFourHoursAgo.toISOString(), last7d: sevenDaysAgo.toISOString() },
    kpis: {
      totalProviders,
      activeProviders,
      healthyProviders,
      degradedProviders,
      downProviders,
      totalRequests7d,
      totalFailures7d,
      overallSuccessRate,
      totalTokens24h,
      totalFailovers7d,
      avgLatencyOverall,
      runningTasksCount: runningTasks.length,
    },
    providerStats,
    latencySeries,
    volumeSeries,
    runningTasks: runningTasksEnriched,
    topTransitions,
    tokenUsage,
  });
}
