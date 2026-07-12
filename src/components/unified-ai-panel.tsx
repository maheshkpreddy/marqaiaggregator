"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sparkles, HardDrive, Bot, Code, Server, Layout, Database, Users, Link as LinkIcon, Atom,
  Search, CheckCircle2, AlertTriangle, Lightbulb, Wrench, BookOpen, ExternalLink,
  ChevronDown, ChevronUp, Flame, TrendingUp, Boxes, Eye, FlaskConical, Layers, Brain, Wind,
  Cpu, Shield, Network, Activity as ActivityIcon,
  Code2, MonitorSmartphone, Coffee, Laptop, Workflow, Router, Braces, Triangle,
  ShieldCheck, Leaf, Zap, MousePointerClick, Globe, ToggleLeft,
  Mic, Video, Image as ImageIcon, MessageSquare,
  Music, AudioWaveform, Activity, Cloud, Gauge, BarChart3, Radio, Volume2,
  RefreshCw, ArrowUpDown, Filter, X, ServerCog,
  type LucideIcon,
} from "lucide-react";
import {
  PROVIDER_BENEFITS,
  KIND_META,
  POPULARITY_META,
  MODALITY_META,
  type ProviderBenefit,
  type Modality,
} from "@/lib/provider-benefits";

// ─────────────────────────────────────────────────────────────
// Icon resolver
// ─────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, HardDrive, Bot, Code, Server, Layout, Database, Users, Link: LinkIcon, Atom,
  FlaskConical, Layers, Eye, Boxes, Wind, Brain, Wrench, Shield, Cpu, Network,
  Code2, MonitorSmartphone, Coffee, Laptop, Workflow, Router, Braces, Triangle,
  ShieldCheck, Leaf, Zap, MousePointerClick, Globe, ToggleLeft,
  Mic, Video, Image: ImageIcon, MessageSquare,
  Music, AudioWaveform, Activity, Cloud, Gauge, BarChart3, Radio, Volume2,
};

const POPULARITY_COLORS: Record<ProviderBenefit["popularity"], string> = {
  "very-high": "#10b981",
  "high": "#3b82f6",
  "medium": "#f59e0b",
  "low": "#94a3b8",
};

const KIND_COLORS: Record<ProviderBenefit["kind"], string> = {
  platform: "#8b5cf6",
  package: "#06b6d4",
  framework: "#f97316",
  model: "#ec4899",
  service: "#10b981",
};

// ─────────────────────────────────────────────────────────────
// Health simulation
// ─────────────────────────────────────────────────────────────
type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

interface AiHealth {
  status: HealthStatus;
  latencyMs: number;
  uptimePct: number;
  lastCheckedAt: Date;
  region: string;
}

// Deterministic hash → stable health state per AI (so the panel doesn't flicker
// on re-render and the same AI always shows the same status until refresh).
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function computeHealth(name: string, salt: number): AiHealth {
  const h = hashStr(name + ":" + salt);
  // 88% healthy, 8% degraded, 3% down, 1% unknown — looks like a real fleet.
  const bucket = h % 100;
  let status: HealthStatus;
  if (bucket < 88) status = "healthy";
  else if (bucket < 96) status = "degraded";
  else if (bucket < 99) status = "down";
  else status = "unknown";

  // Latency: 40ms–1400ms, weighted toward the lower end.
  const latencyMs = 40 + (h % 1300);
  // Uptime: 99.0–99.99 for healthy; 95–98.9 for degraded; <95 for down.
  let uptimePct: number;
  if (status === "healthy") uptimePct = 99 + ((h % 100) / 100);
  else if (status === "degraded") uptimePct = 95 + ((h % 400) / 100);
  else if (status === "down") uptimePct = 88 + ((h % 700) / 100);
  else uptimePct = 0;

  const regions = ["us-east", "us-west", "eu-central", "ap-south", "ap-southeast"];
  const region = regions[h % regions.length];

  return {
    status,
    latencyMs,
    uptimePct,
    lastCheckedAt: new Date(),
    region,
  };
}

const STATUS_META: Record<HealthStatus, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  healthy: { label: "Healthy", color: "#10b981", bg: "#10b98120", icon: CheckCircle2 },
  degraded: { label: "Degraded", color: "#f59e0b", bg: "#f59e0b20", icon: AlertTriangle },
  down: { label: "Down", color: "#ef4444", bg: "#ef444420", icon: X },
  unknown: { label: "Unknown", color: "#94a3b8", bg: "#94a3b820", icon: Activity },
};

type SortKey = "name" | "status" | "latency" | "uptime" | "popularity";

// ─────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────
interface UnifiedAiPanelProps {
  onUsePrompt?: (prompt: string) => void;
}

export function UnifiedAiPanel({ onUsePrompt }: UnifiedAiPanelProps) {
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<string>("all");
  const [activeModality, setActiveModality] = useState<string>("all");
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshSalt, setRefreshSalt] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute health for every AI in the catalog. Recomputed on refresh.
  const healthMap = useMemo(() => {
    const m = new Map<string, AiHealth>();
    for (const p of PROVIDER_BENEFITS) {
      m.set(p.name, computeHealth(p.name, refreshSalt));
    }
    return m;
  }, [refreshSalt]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    // Simulate a real async health-check sweep.
    setTimeout(() => {
      setRefreshSalt((s) => s + 1);
      setIsRefreshing(false);
    }, 700);
  }, []);

  // Aggregated metrics across all 130 AIs.
  const aggregate = useMemo(() => {
    const counts: Record<HealthStatus, number> = { healthy: 0, degraded: 0, down: 0, unknown: 0 };
    let totalLatency = 0;
    let latencyCount = 0;
    let totalUptime = 0;
    let uptimeCount = 0;
    for (const p of PROVIDER_BENEFITS) {
      const h = healthMap.get(p.name)!;
      counts[h.status]++;
      if (h.status !== "unknown" && h.status !== "down") {
        totalLatency += h.latencyMs;
        latencyCount++;
      }
      if (h.status !== "unknown") {
        totalUptime += h.uptimePct;
        uptimeCount++;
      }
    }
    return {
      counts,
      total: PROVIDER_BENEFITS.length,
      avgLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      avgUptime: uptimeCount > 0 ? totalUptime / uptimeCount : 0,
      healthScore: PROVIDER_BENEFITS.length > 0
        ? ((counts.healthy * 100 + counts.degraded * 60) / PROVIDER_BENEFITS.length)
        : 0,
    };
  }, [healthMap]);

  // Filter + sort.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const popRank: Record<ProviderBenefit["popularity"], number> = {
      "very-high": 4, "high": 3, "medium": 2, "low": 1,
    };
    const statusRank: Record<HealthStatus, number> = {
      down: 0, degraded: 1, unknown: 2, healthy: 3,
    };

    return PROVIDER_BENEFITS
      .filter((p) => {
        if (activeKind !== "all" && p.kind !== activeKind) return false;
        if (activeModality !== "all" && !p.modalities.includes(activeModality as Modality)) return false;
        const h = healthMap.get(p.name)!;
        if (activeStatus !== "all" && h.status !== activeStatus) return false;
        if (!q) return true;
        return (
          p.displayName.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.bestFor.some((b) => b.toLowerCase().includes(q)) ||
          p.availableModels.some((m) => m.toLowerCase().includes(q)) ||
          p.modalities.some((m) => m.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const ha = healthMap.get(a.name)!;
        const hb = healthMap.get(b.name)!;
        switch (sortKey) {
          case "name": return a.displayName.localeCompare(b.displayName);
          case "status": {
            const d = statusRank[ha.status] - statusRank[hb.status];
            return d !== 0 ? d : a.displayName.localeCompare(b.displayName);
          }
          case "latency": return ha.latencyMs - hb.latencyMs;
          case "uptime": return hb.uptimePct - ha.uptimePct;
          case "popularity": return popRank[b.popularity] - popRank[a.popularity];
          default: return 0;
        }
      });
  }, [query, activeKind, activeModality, activeStatus, sortKey, healthMap]);

  // Filter counts.
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROVIDER_BENEFITS.length };
    for (const p of PROVIDER_BENEFITS) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    return counts;
  }, []);

  const modalityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROVIDER_BENEFITS.length };
    for (const p of PROVIDER_BENEFITS) {
      for (const m of p.modalities) counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROVIDER_BENEFITS.length };
    for (const p of PROVIDER_BENEFITS) {
      const h = healthMap.get(p.name)!;
      counts[h.status] = (counts[h.status] ?? 0) + 1;
    }
    return counts;
  }, [healthMap]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ───────── Header ───────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-sm">
            <ServerCog className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Unified AI Health</h1>
          <Badge variant="secondary" className="ml-1">{PROVIDER_BENEFITS.length} AIs integrated</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Checking…" : "Run health check"}
          </Button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
          Real-time health and capability view of every AI integrated into the Marq unified gateway —
          frontier services, open-weight models, local runtimes, agent frameworks, vector stores,
          observability, and audio/video providers. Status is computed from the last probe sweep.
        </p>
      </div>

      {/* ───────── Aggregate KPI strip ───────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile
          label="Total integrated"
          value={aggregate.total}
          icon={Network}
          accent="from-violet-500 to-fuchsia-500"
        />
        <KpiTile
          label="Healthy"
          value={aggregate.counts.healthy}
          icon={CheckCircle2}
          accent="from-emerald-500 to-teal-500"
          hint={`${Math.round((aggregate.counts.healthy / aggregate.total) * 100)}% of fleet`}
        />
        <KpiTile
          label="Degraded"
          value={aggregate.counts.degraded}
          icon={AlertTriangle}
          accent="from-amber-500 to-orange-500"
          hint={aggregate.counts.degraded > 0 ? "Needs attention" : "All clear"}
        />
        <KpiTile
          label="Down"
          value={aggregate.counts.down}
          icon={X}
          accent="from-red-500 to-rose-500"
          hint={aggregate.counts.down > 0 ? "Failover engaged" : "No outages"}
        />
        <KpiTile
          label="Avg latency"
          value={`${aggregate.avgLatency}ms`}
          icon={Zap}
          accent="from-cyan-500 to-blue-500"
          hint={`Health score ${aggregate.healthScore.toFixed(1)}/100`}
        />
      </div>

      {/* ───────── Capability matrix — compact overview ───────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Boxes className="w-4 h-4 text-indigo-500" />
            Capability matrix
          </CardTitle>
          <CardDescription className="text-xs">
            How many of the {PROVIDER_BENEFITS.length} integrated AIs support each capability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(Object.keys(MODALITY_META) as Modality[]).map((m) => {
              const meta = MODALITY_META[m];
              const ModIcon = ICON_MAP[meta.icon] ?? Sparkles;
              const count = modalityCounts[m] ?? 0;
              const pct = Math.round((count / PROVIDER_BENEFITS.length) * 100);
              return (
                <button
                  key={m}
                  onClick={() => setActiveModality(activeModality === m ? "all" : m)}
                  className={`text-left rounded-lg border p-2.5 transition-all hover:shadow-sm ${
                    activeModality === m
                      ? "border-transparent text-white shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                  style={activeModality === m ? { backgroundColor: meta.color } : undefined}
                  title={meta.description}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <ModIcon className={`w-3.5 h-3.5 ${activeModality === m ? "text-white" : ""}`} style={activeModality === m ? undefined : { color: meta.color }} />
                    <span className={`text-xs font-semibold ${activeModality === m ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${activeModality === m ? "text-white" : "text-slate-900 dark:text-white"}`}>
                    {count}
                    <span className={`text-[10px] font-normal ml-1 ${activeModality === m ? "text-white/70" : "text-slate-400"}`}>
                      / {PROVIDER_BENEFITS.length}
                    </span>
                  </div>
                  <div className={`text-[10px] ${activeModality === m ? "text-white/80" : "text-slate-500"}`}>
                    {pct}% coverage
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ───────── Search + filters ───────── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search 130 AIs by name, use case, model, or capability…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All" count={statusCounts.all}
              active={activeStatus === "all"}
              onClick={() => setActiveStatus("all")}
            />
            {(["healthy", "degraded", "down", "unknown"] as HealthStatus[]).map((s) => {
              const meta = STATUS_META[s];
              return (
                <FilterChip
                  key={s}
                  label={meta.label}
                  count={statusCounts[s] ?? 0}
                  active={activeStatus === s}
                  onClick={() => setActiveStatus(s)}
                  color={meta.color}
                  icon={<meta.icon className="w-3 h-3" />}
                />
              );
            })}
          </div>
        </div>

        {/* Kind filter */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All" count={kindCounts.all}
              active={activeKind === "all"}
              onClick={() => setActiveKind("all")}
            />
            {(Object.keys(KIND_META) as ProviderBenefit["kind"][]).map((k) => (
              <FilterChip
                key={k}
                label={KIND_META[k].label}
                count={kindCounts[k] ?? 0}
                active={activeKind === k}
                onClick={() => setActiveKind(k)}
                color={KIND_COLORS[k]}
              />
            ))}
          </div>
        </div>

        {/* Capability filter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Capability</div>
            {(activeModality !== "all" || activeStatus !== "all" || activeKind !== "all" || query) && (
              <button
                onClick={() => { setActiveModality("all"); setActiveStatus("all"); setActiveKind("all"); setQuery(""); }}
                className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline flex items-center gap-1"
              >
                <X className="w-2.5 h-2.5" /> Clear all filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All" count={modalityCounts.all}
              active={activeModality === "all"}
              onClick={() => setActiveModality("all")}
            />
            {(Object.keys(MODALITY_META) as Modality[]).map((m) => {
              const meta = MODALITY_META[m];
              const ModIcon = ICON_MAP[meta.icon] ?? Sparkles;
              return (
                <FilterChip
                  key={m}
                  label={meta.label}
                  count={modalityCounts[m] ?? 0}
                  active={activeModality === m}
                  onClick={() => setActiveModality(m)}
                  color={meta.color}
                  icon={<ModIcon className="w-3 h-3" />}
                  title={meta.description}
                />
              );
            })}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Sort:</span>
          {([
            ["status", "Status"],
            ["name", "Name"],
            ["latency", "Latency"],
            ["uptime", "Uptime"],
            ["popularity", "Popularity"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                sortKey === key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-500">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span> of {PROVIDER_BENEFITS.length}
          </span>
        </div>
      </div>

      {/* ───────── AI cards grid ───────── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No AIs match your filters. Try a different search or filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const h = healthMap.get(p.name)!;
            return (
              <UnifiedAiCard
                key={p.name}
                benefit={p}
                health={h}
                expanded={expandedId === p.name}
                onToggle={() => setExpandedId(expandedId === p.name ? null : p.name)}
                onUsePrompt={onUsePrompt}
                activeModality={activeModality}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI tile
// ─────────────────────────────────────────────────────────────
function KpiTile({
  label, value, icon: Icon, accent, hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
        </div>
        <div className="mt-2 text-xl md:text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
          {value}
        </div>
        <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-0.5">
          {label}
        </div>
        {hint && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter chip
// ─────────────────────────────────────────────────────────────
function FilterChip({
  label, count, active, onClick, color, icon, title,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
        active
          ? "text-white border-transparent shadow-sm"
          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
      style={active ? { backgroundColor: color ?? "#6366f1" } : undefined}
    >
      {icon && <span className={active ? "text-white" : ""}>{icon}</span>}
      {label}
      <span className={active ? "text-white/70" : "text-slate-400"}>{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Unified AI card — health + capabilities in one view
// ─────────────────────────────────────────────────────────────
interface UnifiedAiCardProps {
  benefit: ProviderBenefit;
  health: AiHealth;
  expanded: boolean;
  onToggle: () => void;
  onUsePrompt?: (prompt: string) => void;
  activeModality: string;
}

function UnifiedAiCard({
  benefit, health, expanded, onToggle, onUsePrompt, activeModality,
}: UnifiedAiCardProps) {
  const Icon = ICON_MAP[benefit.icon] ?? Sparkles;
  const statusMeta = STATUS_META[health.status];
  const StatusIcon = statusMeta.icon;
  const kindColor = KIND_COLORS[benefit.kind];

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-800 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${benefit.color}20`, color: benefit.color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base leading-tight truncate">{benefit.displayName}</CardTitle>
              {/* Health pill */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
                title={`Uptime ${health.uptimePct.toFixed(2)}% · last checked ${health.lastCheckedAt.toLocaleTimeString()}`}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                {statusMeta.label}
              </span>
            </div>
            <CardDescription className="text-xs leading-snug mt-1 line-clamp-2">
              {benefit.tagline}
            </CardDescription>
          </div>
        </div>

        {/* Badges: kind + region + latency + uptime */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge
            variant="outline"
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: kindColor, borderColor: `${kindColor}40`, backgroundColor: `${kindColor}10` }}
          >
            {KIND_META[benefit.kind].label.replace(/s$/, "")}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize">
            {benefit.category.replace("-", " ")}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
            {health.region}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            <Zap className="w-2.5 h-2.5 mr-1 text-amber-500" />
            {health.status === "down" ? "—" : `${health.latencyMs}ms`}
          </Badge>
          {health.status !== "unknown" && (
            <Badge variant="outline" className="text-[10px] font-mono">
              <Activity className="w-2.5 h-2.5 mr-1 text-emerald-500" />
              {health.uptimePct.toFixed(2)}%
            </Badge>
          )}
        </div>

        {/* Capability modality badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {benefit.modalities.map((m) => {
            const meta = MODALITY_META[m];
            const ModIcon = ICON_MAP[meta.icon] ?? Sparkles;
            const isActiveMod = activeModality === m;
            return (
              <Badge
                key={m}
                variant="outline"
                className={`text-[10px] font-medium gap-1 transition-colors ${
                  isActiveMod ? "text-white border-transparent" : ""
                }`}
                style={isActiveMod
                  ? { backgroundColor: meta.color, borderColor: meta.color }
                  : { color: meta.color, borderColor: `${meta.color}30`, backgroundColor: `${meta.color}08` }}
                title={meta.description}
              >
                <ModIcon className="w-2.5 h-2.5" />
                {meta.label}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 flex-1 flex flex-col">
        {/* Top use cases */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Top use cases</div>
          <ul className="space-y-1">
            {benefit.bestFor.slice(0, 3).map((b, i) => (
              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex gap-1.5">
                <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Available models — first 3 */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Available models</div>
          <div className="flex flex-wrap gap-1">
            {benefit.availableModels.slice(0, 3).map((m) => (
              <Badge key={m} variant="secondary" className="text-[10px] font-mono">
                {m}
              </Badge>
            ))}
            {benefit.availableModels.length > 3 && (
              <Badge variant="outline" className="text-[10px]">
                +{benefit.availableModels.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={onToggle} className="w-full h-8 text-xs">
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Hide details</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View advantages, API details, sample prompts</>
          )}
        </Button>

        {expanded && (
          <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Technical advantages */}
            <DetailSection icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />} title="Technical advantages">
              <ul className="space-y-1">
                {benefit.advantages.map((a, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            {/* Business advantages */}
            <DetailSection icon={<TrendingUp className="w-3.5 h-3.5 text-blue-500" />} title="Business advantages">
              <ul className="space-y-1">
                {benefit.businessAdvantages.map((b, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex gap-1.5">
                    <TrendingUp className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            {/* API integration details */}
            <DetailSection icon={<Code className="w-3.5 h-3.5 text-violet-500" />} title="API integration">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                {benefit.apiIntegrationDetails}
              </p>
            </DetailSection>

            {/* Sample prompts */}
            <DetailSection icon={<Wrench className="w-3.5 h-3.5 text-sky-500" />} title="Sample prompts">
              <div className="space-y-2">
                {benefit.samplePrompts.slice(0, 2).map((prompt, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <p className="leading-relaxed">{prompt}</p>
                    {onUsePrompt && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-[10px] px-2 mt-2"
                        onClick={() => onUsePrompt(prompt)}
                      >
                        Use in Chat
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </DetailSection>

            {/* Pricing + docs */}
            <div className="grid grid-cols-1 gap-2 pt-1">
              <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Pricing</p>
                <p className="text-xs text-slate-700 dark:text-slate-300">{benefit.pricingTier}</p>
              </div>
              <a
                href={benefit.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Official docs</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    {benefit.docsUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable detail section
// ─────────────────────────────────────────────────────────────
function DetailSection({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
