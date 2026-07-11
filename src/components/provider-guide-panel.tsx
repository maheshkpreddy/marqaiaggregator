"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sparkles, HardDrive, Bot, Code, Server, Layout, Database, Users, Link as LinkIcon, Atom,
  Search, CheckCircle2, AlertTriangle, Lightbulb, Wrench, BookOpen, ExternalLink, Copy, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  PROVIDER_BENEFITS,
  CATEGORY_META,
  type ProviderBenefit,
} from "@/lib/provider-benefits";

// Icon resolver — maps the string icon name in the data file to the actual Lucide component.
const ICON_MAP: Record<string, typeof Sparkles> = {
  Sparkles, HardDrive, Bot, Code, Server, Layout, Database, Users, Link: LinkIcon, Atom,
};

/**
 * ProviderGuidePanel
 *
 * A read-only catalog of every provider on the platform, organized by category,
 * explaining what each provider is best at, what you can do with it, when to
 * pick it, sample prompts, and setup notes. Designed to help users make
 * informed choices about which providers to enable and how to use them.
 *
 * The panel takes an optional `onUsePrompt` callback so the chat tab can
 * pre-fill the input when the user clicks "Use this prompt" on a sample.
 */
interface ProviderGuidePanelProps {
  onUsePrompt?: (prompt: string) => void;
}

export function ProviderGuidePanel({ onUsePrompt }: ProviderGuidePanelProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Filter by search query and active category.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROVIDER_BENEFITS.filter((p) => {
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.bestFor.some((b) => b.toLowerCase().includes(q)) ||
        p.capabilities.some((c) => c.toLowerCase().includes(q)) ||
        p.whenToUse.some((w) => w.toLowerCase().includes(q))
      );
    });
  }, [query, activeCategory]);

  // Group by category for display when no category filter is active.
  const grouped = useMemo(() => {
    if (activeCategory !== "all") {
      return [{ category: activeCategory as ProviderBenefit["category"], items: filtered }];
    }
    const order: ProviderBenefit["category"][] = ["frontier", "open-source", "local", "specialized", "orchestration"];
    return order
      .map((c) => ({
        category: c,
        items: filtered.filter((p) => p.category === c),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered, activeCategory]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(text);
      setTimeout(() => setCopiedPrompt(null), 1500);
    } catch {
      // Clipboard API can fail in some browsers — fall back to using the prompt in chat.
      onUsePrompt?.(text);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PROVIDER_BENEFITS.length };
    for (const p of PROVIDER_BENEFITS) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-semibold tracking-tight">Provider Guide</h2>
          <Badge variant="secondary" className="ml-2">{PROVIDER_BENEFITS.length} providers</Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          A plain-English catalog of every AI provider on the Marq platform — what each one is
          genuinely good at, when to pick it, sample prompts to try, and how to wire up a real
          API key. Use this to decide which providers to enable and which to use as your primary
          vs. failover targets.
        </p>
      </div>

      {/* Search + category filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search providers, capabilities, or use cases…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label="All"
            count={categoryCounts.all}
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {(Object.keys(CATEGORY_META) as ProviderBenefit["category"][]).map((c) => (
            <CategoryChip
              key={c}
              label={CATEGORY_META[c].label}
              count={categoryCounts[c] ?? 0}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>
      </div>

      {/* Category description */}
      {activeCategory !== "all" && (
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 p-3 text-sm text-indigo-900 dark:text-indigo-200">
          <strong className="font-medium">{CATEGORY_META[activeCategory as ProviderBenefit["category"]].label}:</strong>{" "}
          {CATEGORY_META[activeCategory as ProviderBenefit["category"]].description}
        </div>
      )}

      {/* Provider cards grouped by category */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No providers match your search. Try a different keyword or category.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.category} className="space-y-3">
            {activeCategory === "all" && (
              <div className="flex items-baseline gap-2 pt-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {CATEGORY_META[group.category].label}
                </h3>
                <span className="text-xs text-slate-400">({group.items.length})</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {group.items.map((p) => (
                <ProviderCard
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
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Category filter chip
// ─────────────────────────────────────────────────────────────
function CategoryChip({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
      }`}
    >
      {label} <span className={active ? "text-indigo-200" : "text-slate-400"}>{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Provider card
// ─────────────────────────────────────────────────────────────
interface ProviderCardProps {
  benefit: ProviderBenefit;
  expanded: boolean;
  onToggle: () => void;
  onUsePrompt?: (prompt: string) => void;
  onCopyPrompt: (text: string) => void;
  copiedPrompt: string | null;
}

function ProviderCard({
  benefit, expanded, onToggle, onUsePrompt, onCopyPrompt, copiedPrompt,
}: ProviderCardProps) {
  const Icon = ICON_MAP[benefit.icon] ?? Sparkles;
  const isCopied = (text: string) => copiedPrompt === text;

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${benefit.color}20`, color: benefit.color }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                {benefit.displayName}
              </CardTitle>
              <CardDescription className="text-sm leading-snug mt-0.5">
                {benefit.tagline}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle} className="shrink-0 h-8 w-8 p-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Best-for chips — always visible */}
        <div className="flex flex-wrap gap-1.5">
          {benefit.bestFor.slice(0, 3).map((b) => (
            <Badge key={b} variant="outline" className="text-xs font-normal text-slate-600 dark:text-slate-300">
              {b}
            </Badge>
          ))}
          {benefit.bestFor.length > 3 && (
            <Badge variant="outline" className="text-xs font-normal text-slate-400">
              +{benefit.bestFor.length - 3} more
            </Badge>
          )}
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Best for — full list */}
            <Section icon={<Lightbulb className="w-4 h-4 text-amber-500" />} title="Best for">
              <ul className="space-y-1">
                {benefit.bestFor.map((b, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* What you can do */}
            <Section icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} title="What you can do with it on Marq">
              <ul className="space-y-1">
                {benefit.capabilities.map((c, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* When to use */}
            <Section icon={<Sparkles className="w-4 h-4 text-indigo-500" />} title="When to pick this provider">
              <ul className="space-y-1">
                {benefit.whenToUse.map((w, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                    <span className="text-indigo-500 mt-0.5">→</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Limitations */}
            <Section icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} title="Limitations to know">
              <ul className="space-y-1">
                {benefit.limitations.map((l, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* Sample prompts */}
            <Section icon={<Wrench className="w-4 h-4 text-sky-500" />} title="Sample prompts to try">
              <div className="space-y-2">
                {benefit.samplePrompts.map((prompt, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <p className="leading-relaxed">{prompt}</p>
                    <div className="flex gap-2 mt-2">
                      {onUsePrompt && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => onUsePrompt(prompt)}
                        >
                          Use in Chat
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onCopyPrompt(prompt)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {isCopied(prompt) ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Setup notes */}
            <Section icon={<Wrench className="w-4 h-4 text-slate-500" />} title="Setup notes">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {benefit.setupNotes}
              </p>
            </Section>

            {/* Pricing + docs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Pricing</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{benefit.pricingTier}</p>
              </div>
              <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-3 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Official docs</p>
                <a
                  href={benefit.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  {benefit.docsUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable section wrapper
// ─────────────────────────────────────────────────────────────
function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
