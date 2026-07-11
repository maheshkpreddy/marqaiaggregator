"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, Shield, Zap, Clock, Server, Cpu, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2, Brain, ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

interface ProviderStat {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  active: boolean;
  priority: number;
  hasApiKey: boolean;
  totalChecks: number;
  healthyChecks: number;
  downChecks: number;
  degradedChecks: number;
  successRate: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  last24hChecks: number;
  last24hFailures: number;
  messageCount: number;
  agentStepCount: number;
  failoversFromCount: number;
  failoversToCount: number;
  lastError: string | null;
  lastCheckedAt: string | null;
}

interface LatencyPoint { time: string; hour: string; [providerName: string]: number | string }
interface VolumePoint { time: string; hour: string; healthy: number; degraded: number; down: number; total: number }

interface RunningTask {
  id: string;
  title: string;
  goal: string;
  agentType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
  primaryProvider: { id: string; name: string; displayName: string; color: string; icon: string } | null;
}

interface TopTransition {
  from: string; to: string; fromName: string; toName: string;
  fromColor: string; toColor: string; count: number;
  reasons: Record<string, number>;
}

interface TokenUsage {
  providerId: string; providerName: string; providerColor: string;
  tokens: number; requests: number; avgLatencyMs: number;
}

interface DashboardData {
  generatedAt: string;
  kpis: {
    totalProviders: number; activeProviders: number;
    healthyProviders: number; degradedProviders: number; downProviders: number;
    totalRequests7d: number; totalFailures7d: number; overallSuccessRate: number;
    totalTokens24h: number; totalFailovers7d: number;
    avgLatencyOverall: number | null; runningTasksCount: number;
  };
  providerStats: ProviderStat[];
  latencySeries: LatencyPoint[];
  volumeSeries: VolumePoint[];
  runningTasks: RunningTask[];
  topTransitions: TopTransition[];
  tokenUsage: TokenUsage[];
}

/**
 * AIAnalyticsDashboard
 *
 * Admin-only analytics dashboard for AI provider health, usage, and currently
 * running tasks. Graphical views of: latency over time, request volume by
 * health status, token usage by provider, top failover transitions, and a
 * live table of running agent tasks.
 */
export function AIAnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ai-dashboard");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load dashboard");
      setData(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 30s while the tab is open.
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
            <h3 className="font-semibold text-lg">Cannot load dashboard</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{error}</p>
            <p className="text-xs text-slate-400">
              The AI Health Analytics Dashboard requires admin or owner role. If you believe this
              is an error, ask an owner of your organization to upgrade your role.
            </p>
            <Button onClick={load} variant="outline" className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, providerStats, latencySeries, volumeSeries, runningTasks, topTransitions, tokenUsage } = data;

  // Top 6 providers by request volume for the latency chart (avoids clutter)
  const topProvidersByVolume = [...providerStats]
    .sort((a, b) => b.totalChecks - a.totalChecks)
    .slice(0, 6);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold tracking-tight">AI Health Analytics</h1>
            <Badge variant="secondary" className="ml-1">Admin</Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Real-time health, usage, and performance across every AI provider. Auto-refreshes every 30s.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiTile label="Overall success" value={`${kpis.overallSuccessRate}%`} icon={Shield} color="#10b981"
                 sub={`${kpis.totalRequests7d.toLocaleString()} checks / 7d`} />
        <KpiTile label="Active providers" value={`${kpis.activeProviders}/${kpis.totalProviders}`} icon={Server} color="#3b82f6"
                 sub={`${kpis.healthyProviders} healthy · ${kpis.degradedProviders} degraded · ${kpis.downProviders} down`} />
        <KpiTile label="Avg latency" value={kpis.avgLatencyOverall != null ? `${kpis.avgLatencyOverall}ms` : "—"} icon={Clock} color="#8b5cf6"
                 sub="across all providers" />
        <KpiTile label="Tokens used" value={formatTokens(kpis.totalTokens24h)} icon={Cpu} color="#f59e0b"
                 sub="last 24h" />
        <KpiTile label="Failovers" value={kpis.totalFailovers7d.toLocaleString()} icon={Zap} color="#ec4899"
                 sub="last 7d" />
        <KpiTile label="Running tasks" value={kpis.runningTasksCount.toLocaleString()} icon={Brain} color="#06b6d4"
                 sub="agent tasks in flight" />
      </div>

      {/* Latency over time (top 6 providers) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />
            Provider latency — last 24h (hourly avg)
          </CardTitle>
          <CardDescription>
            Average response latency in milliseconds, bucketed hourly. Showing the {topProvidersByVolume.length} most-active providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencySeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit="ms" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {topProvidersByVolume.map((p) => (
                  <Line
                    key={p.name}
                    type="monotone"
                    dataKey={p.name}
                    stroke={p.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    name={p.displayName}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Request volume (stacked area) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Request volume — last 24h (hourly)
          </CardTitle>
          <CardDescription>
            Health checks per hour, split by outcome. Spikes in "down" indicate provider outages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorHealthy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorDegraded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="healthy" stackId="1" stroke="#10b981" fill="url(#colorHealthy)" name="Healthy" />
                <Area type="monotone" dataKey="degraded" stackId="1" stroke="#f59e0b" fill="url(#colorDegraded)" name="Degraded" />
                <Area type="monotone" dataKey="down" stackId="1" stroke="#ef4444" fill="url(#colorDown)" name="Down" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Token usage + Failover transitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Token usage by provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              Token usage by provider — last 24h
            </CardTitle>
            <CardDescription>
              Total tokens consumed per provider. Empty if no chat/agent traffic in the window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tokenUsage.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No token usage in the last 24h. Send a chat message or run an agent task to see data here.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokenUsage} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="providerName" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(value: number) => formatTokens(value)}
                    />
                    <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                      {tokenUsage.map((t) => (
                        <Cell key={t.providerId} fill={t.providerColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top failover transitions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-pink-500" />
              Top failover transitions — last 7d
            </CardTitle>
            <CardDescription>
              Most frequent provider-to-provider failover pairs. Empty if every request succeeded on the first try.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topTransitions.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                No failovers in the last 7d. Every request succeeded on the first provider.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {topTransitions.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-slate-200 dark:border-slate-800">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium truncate" style={{ color: t.fromColor }}>{t.fromName}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-medium truncate" style={{ color: t.toColor }}>{t.toName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {Object.entries(t.reasons).slice(0, 2).map(([r, c]) => `${r.replace(/_/g, " ")} ×${c}`).join(" · ")}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono">{t.count}×</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider health table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            Provider health breakdown
          </CardTitle>
          <CardDescription>
            Per-provider success rate, latency, traffic, and failover counts. Sorted by priority.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="py-2 px-2 font-medium">Provider</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  <th className="py-2 px-2 font-medium text-right">Success</th>
                  <th className="py-2 px-2 font-medium text-right">Avg ms</th>
                  <th className="py-2 px-2 font-medium text-right">P95 ms</th>
                  <th className="py-2 px-2 font-medium text-right">Checks 7d</th>
                  <th className="py-2 px-2 font-medium text-right">Msgs</th>
                  <th className="py-2 px-2 font-medium text-right">Steps</th>
                  <th className="py-2 px-2 font-medium text-right">Failovers</th>
                </tr>
              </thead>
              <tbody>
                {providerStats.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="font-medium truncate">{p.displayName}</span>
                        {!p.active && <Badge variant="outline" className="text-[9px]">inactive</Badge>}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <StatusPill successRate={p.successRate} />
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{p.successRate}%</td>
                    <td className="py-2 px-2 text-right font-mono">{p.avgLatencyMs ?? "—"}</td>
                    <td className="py-2 px-2 text-right font-mono">{p.p95LatencyMs ?? "—"}</td>
                    <td className="py-2 px-2 text-right font-mono">{p.totalChecks}</td>
                    <td className="py-2 px-2 text-right font-mono">{p.messageCount}</td>
                    <td className="py-2 px-2 text-right font-mono">{p.agentStepCount}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      {p.failoversFromCount > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">{p.failoversFromCount}→</span>
                      ) : "—"}
                      {p.failoversToCount > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 ml-1">→{p.failoversToCount}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Currently running agent tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-500" />
            Currently running agent tasks
            {runningTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1">{runningTasks.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Agent tasks with status=running right now. Auto-refreshes every 30s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runningTasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              No agent tasks currently running.
            </div>
          ) : (
            <div className="space-y-2">
              {runningTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-md border border-slate-200 dark:border-slate-800">
                  <Loader2 className="w-4 h-4 text-cyan-500 animate-spin mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{t.title}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{t.agentType}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{t.stepCount} steps</Badge>
                      {t.primaryProvider && (
                        <Badge variant="outline" className="text-[10px]" style={{ color: t.primaryProvider.color, borderColor: `${t.primaryProvider.color}40` }}>
                          {t.primaryProvider.displayName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{t.goal}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Started {new Date(t.createdAt).toLocaleString()} · Updated {new Date(t.updatedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function KpiTile({
  label, value, icon: Icon, color, sub,
}: { label: string; value: string; icon: LucideIcon; color: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
        </div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-1 truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatusPill({ successRate }: { successRate: number }) {
  if (successRate >= 95) {
    return <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">Healthy</Badge>;
  }
  if (successRate >= 50) {
    return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">Degraded</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30">Down</Badge>;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
