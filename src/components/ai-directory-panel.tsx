"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sparkles, HardDrive, Bot, Code, Server, Layout, Database, Users, Link as LinkIcon, Atom,
  Search, CheckCircle2, AlertTriangle, Lightbulb, Wrench, BookOpen, ExternalLink, Copy,
  ChevronDown, ChevronUp, Flame, TrendingUp, Boxes, Eye, FlaskConical, Layers, Brain, Wind,
  Cpu, Shield, Network,
  // New icons for infrabase.ai alternatives
  Code2, MonitorSmartphone, Coffee, Laptop, Workflow, Router, Braces, Triangle,
  ShieldCheck, Leaf, Zap, MousePointerClick, Globe, ToggleLeft,
  type LucideIcon,
} from "lucide-react";
import {
  PROVIDER_BENEFITS,
  KIND_META,
  POPULARITY_META,
  type ProviderBenefit,
} from "@/lib/provider-benefits";

// Icon resolver — maps the string icon name in the data file to the actual Lucide component.
const ICON_MAP: Record<string, LucideIcon> = {
  // Original icons
  Sparkles, HardDrive, Bot, Code, Server, Layout, Database, Users, Link: LinkIcon, Atom,
  FlaskConical, Layers, Eye, Boxes, Wind, Brain, Wrench, Shield, Cpu, Network,
  // New icons for infrabase.ai alternatives
  Code2, MonitorSmartphone, Coffee, Laptop, Workflow, Router, Braces, Triangle,
  ShieldCheck, Leaf, Zap, MousePointerClick, Globe, ToggleLeft,
};

const POPULARITY_COLORS: Record<ProviderBenefit["popularity"], string> = {
  "very-high": "#10b981",  // emerald
  "high": "#3b82f6",       // blue
  "medium": "#f59e0b",     // amber
  "low": "#94a3b8",        // slate
};

const KIND_COLORS: Record<ProviderBenefit["kind"], string> = {
  platform: "#8b5cf6",   // purple
  package: "#06b6d4",    // cyan
  framework: "#f97316",  // orange
  model: "#ec4899",      // pink
  service: "#10b981",    // emerald
};

/**
 * AIDirectoryPanel
 *
 * The "AI Directory" tab — a browsable catalog of every AI provider, platform,
 * package, framework, and model integrated into the Marq platform. Each card
 * shows: kind, popularity, use cases, available models, available agents,
 * technical advantages, business advantages, and API integration details.
 *
 * Designed for admins and engineers evaluating which AIs to wire up.
 */
interface AIDirectoryPanelProps {
  onUsePrompt?: (prompt: string) => void;
}

export function AIDirectoryPanel({ onUsePrompt }: AIDirectoryPanelProps) {
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<string>("all");
  const [activePopularity, setActivePopularity] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Filter + sort: by popularity rank (desc), then alphabetical.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROVIDER_BENEFITS
      .filter((p) => {
        if (activeKind !== "all" && p.kind !== activeKind) return false;
        if (activePopularity !== "all" && p.popularity !== activePopularity) return false;
        if (!q) return true;
        return (
          p.displayName.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.bestFor.some((b) => b.toLowerCase().includes(q)) ||
          p.advantages.some((a) => a.toLowerCase().includes(q)) ||
          p.availableModels.some((m) => m.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const popDiff = POPULARITY_META[b.popularity].rank - POPULARITY_META[a.popularity].rank;
        if (popDiff !== 0) return popDiff;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [query, activeKind, activePopularity]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROVIDER_BENEFITS.length };
    for (const p of PROVIDER_BENEFITS) {
      counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    }
    return counts;
  }, []);

  const popularityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROVIDER_BENEFITS.length };
    for (const p of PROVIDER_BENEFITS) {
      counts[p.popularity] = (counts[p.popularity] ?? 0) + 1;
    }
    return counts;
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(text);
      setTimeout(() => setCopiedPrompt(null), 1500);
    } catch {
      onUsePrompt?.(text);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Network className="w-6 h-6 text-violet-500" />
          <h1 className="text-2xl font-bold tracking-tight">AI Directory</h1>
          <Badge variant="secondary" className="ml-1">{PROVIDER_BENEFITS.length} AIs</Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
          A complete catalog of every AI integrated into the Marq platform — platforms, packages,
          frameworks, models, and services. Compare by popularity, use cases, available models,
          technical advantages, business benefits, and API integration details.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by name, use case, advantage, or model…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Kind filter */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</div>
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

      {/* Popularity filter */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Popularity</div>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All" count={popularityCounts.all}
            active={activePopularity === "all"}
            onClick={() => setActivePopularity("all")}
          />
          {(Object.keys(POPULARITY_META) as ProviderBenefit["popularity"][]).map((p) => (
            <FilterChip
              key={p}
              label={POPULARITY_META[p].label}
              count={popularityCounts[p] ?? 0}
              active={activePopularity === p}
              onClick={() => setActivePopularity(p)}
              color={POPULARITY_COLORS[p]}
            />
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span> of {PROVIDER_BENEFITS.length} AIs
      </div>

      {/* Grid of AI cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No AIs match your filters. Try a different search or filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <DirectoryCard
              key={p.name}
              benefit={p}
              expanded={expandedId === p.name}
              onToggle={() => setExpandedId(expandedId === p.name ? null : p.name)}
              onUsePrompt={onUsePrompt}
              onCopyPrompt={handleCopy}
              copiedPrompt={copiedPrompt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Filter chip
// ─────────────────────────────────────────────────────────────
function FilterChip({
  label, count, active, onClick, color,
}: { label: string; count: number; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "text-white border-transparent"
          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
      style={active ? { backgroundColor: color ?? "#6366f1" } : undefined}
    >
      {label} <span className={active ? "text-white/70" : "text-slate-400"}>{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Directory card
// ─────────────────────────────────────────────────────────────
interface DirectoryCardProps {
  benefit: ProviderBenefit;
  expanded: boolean;
  onToggle: () => void;
  onUsePrompt?: (prompt: string) => void;
  onCopyPrompt: (text: string) => void;
  copiedPrompt: string | null;
}

function DirectoryCard({
  benefit, expanded, onToggle, onUsePrompt, onCopyPrompt, copiedPrompt,
}: DirectoryCardProps) {
  const Icon = ICON_MAP[benefit.icon] ?? Sparkles;
  const isCopied = (text: string) => copiedPrompt === text;
  const kindColor = KIND_COLORS[benefit.kind];
  const popularityColor = POPULARITY_COLORS[benefit.popularity];

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
            <CardTitle className="text-base leading-tight">{benefit.displayName}</CardTitle>
            <CardDescription className="text-xs leading-snug mt-1 line-clamp-2">
              {benefit.tagline}
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge
            variant="outline"
            className="text-[10px] font-medium uppercase tracking-wide"
            style={{ color: kindColor, borderColor: `${kindColor}40`, backgroundColor: `${kindColor}10` }}
          >
            {KIND_META[benefit.kind].label.replace(/s$/, "")}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] font-medium"
            style={{ color: popularityColor, borderColor: `${popularityColor}40`, backgroundColor: `${popularityColor}10` }}
          >
            <Flame className="w-2.5 h-2.5 mr-1" />
            {POPULARITY_META[benefit.popularity].label}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize">
            {benefit.category.replace("-", " ")}
          </Badge>
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

        {/* Spacer pushes the expand button to the bottom */}
        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={onToggle} className="w-full h-8 text-xs">
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Hide details</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View advantages, business benefits, API details</>
          )}
        </Button>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Available agents */}
            {benefit.availableAgents.length > 0 && (
              <DetailSection icon={<Bot className="w-3.5 h-3.5 text-indigo-500" />} title="Pairs well with Marq agents">
                <div className="flex flex-wrap gap-1">
                  {benefit.availableAgents.map((a) => (
                    <Badge key={a} variant="outline" className="text-[10px] font-mono">
                      {a}
                    </Badge>
                  ))}
                </div>
              </DetailSection>
            )}

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

            {/* When to use */}
            <DetailSection icon={<Lightbulb className="w-3.5 h-3.5 text-amber-500" />} title="When to use this">
              <ul className="space-y-1">
                {benefit.whenToUse.map((w, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex gap-1.5">
                    <span className="text-amber-500 mt-0.5">→</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            {/* Limitations */}
            <DetailSection icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />} title="Limitations">
              <ul className="space-y-1">
                {benefit.limitations.map((l, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </DetailSection>

            {/* Sample prompts */}
            <DetailSection icon={<Wrench className="w-3.5 h-3.5 text-sky-500" />} title="Sample prompts">
              <div className="space-y-2">
                {benefit.samplePrompts.map((prompt, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <p className="leading-relaxed">{prompt}</p>
                    <div className="flex gap-1.5 mt-2">
                      {onUsePrompt && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 text-[10px] px-2"
                          onClick={() => onUsePrompt(prompt)}
                        >
                          Use in Chat
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2"
                        onClick={() => onCopyPrompt(prompt)}
                      >
                        <Copy className="w-2.5 h-2.5 mr-1" />
                        {isCopied(prompt) ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>

            {/* API integration details */}
            <DetailSection icon={<Code className="w-3.5 h-3.5 text-violet-500" />} title="API integration">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                {benefit.apiIntegrationDetails}
              </p>
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
