"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sparkles, MessageSquare, Brain, GitCompare, Activity, Shield,
  Users, Key, BookOpen, Network, BarChart3, ArrowRight, Zap,
  CheckCircle2, AlertTriangle, XCircle, Clock, TrendingUp, Cpu,
  Layers, Workflow, Server, Globe, Lock, ChevronRight, Plus,
  FileText, BookMarked, ServerCog,
} from "lucide-react";

// ---------- Types ----------
interface Provider {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  active: boolean;
  lastLatencyMs: number | null;
  models: string[];
}

interface FailoverLog {
  id: string;
  reason: string;
  createdAt: string;
  fromProvider: { id: string; name: string; displayName: string; color: string };
  toProvider: { id: string; name: string; displayName: string; color: string };
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
}

export type Role = "owner" | "admin" | "member" | "viewer";

interface DashboardPanelProps {
  user: { id: string; email: string; name: string | null };
  org: { id: string; name: string; slug: string; plan: string };
  role: Role;
  providers: Provider[];
  failovers: FailoverLog[];
  sessions: Session[];
  onNavigate: (
    tab: "chat" | "compare" | "prompts" | "agent" | "providers" | "health" | "failovers" | "org" | "apikeys" | "guide" | "directory" | "unified-ai" | "analytics" | "docs",
  ) => void;
  onNewChat: () => void;
}

interface DashboardKpi {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Activity;
  accent: string; // tailwind gradient stops e.g. "from-emerald-500 to-teal-500"
  onClick?: () => void;
}

/**
 * DashboardPanel — role-aware landing screen shown immediately after login.
 *
 * The dashboard adapts to the user's role:
 *   - owner / admin: full operational picture (providers, failovers, members, API keys, analytics)
 *   - member: productivity-focused (recent chats, agent runs, prompt library, model compare)
 *   - viewer: read-only metrics (health, failover log, analytics) without action buttons
 *
 * All cards are clickable shortcuts into the relevant module.
 */
export function DashboardPanel({
  user, org, role, providers, failovers, sessions, onNavigate, onNewChat,
}: DashboardPanelProps) {
  const healthyCount = providers.filter((p) => p.status === "healthy").length;
  const degradedCount = providers.filter((p) => p.status === "degraded").length;
  const downCount = providers.filter((p) => p.status === "down").length;
  const activeProviders = providers.filter((p) => p.active);
  const recentFailovers = failovers.slice(0, 5);
  const recentSessions = sessions.slice(0, 4);

  const isManager = role === "owner" || role === "admin";
  const isViewer = role === "viewer";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = (user.name || user.email).split(/[ .@]/)[0] || "there";

  // KPI tiles — role-tuned
  const kpis: DashboardKpi[] = [
    {
      label: "Active providers",
      value: `${activeProviders.length}`,
      hint: `${providers.length} total`,
      icon: Server,
      accent: "from-blue-500 to-cyan-500",
      onClick: () => onNavigate("providers"),
    },
    {
      label: "Healthy",
      value: healthyCount,
      hint: degradedCount > 0 || downCount > 0 ? `${degradedCount} degraded · ${downCount} down` : "All systems go",
      icon: CheckCircle2,
      accent: "from-emerald-500 to-teal-500",
      onClick: () => onNavigate("health"),
    },
    {
      label: "Recent failovers",
      value: failovers.length,
      hint: failovers.length === 0 ? "No reroutes needed" : "Auto-recovery active",
      icon: Zap,
      accent: "from-amber-500 to-orange-500",
      onClick: () => onNavigate("failovers"),
    },
    {
      label: "Conversations",
      value: sessions.length,
      hint: sessions.length === 0 ? "Start your first chat" : "Across all models",
      icon: MessageSquare,
      accent: "from-violet-500 to-fuchsia-500",
      onClick: () => onNavigate("chat"),
    },
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* ───────── Hero ───────── */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm">
          {/* Decorative gradient */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br from-violet-400/10 to-fuchsia-400/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {role}
                </Badge>
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/50">
                  {org.plan} plan
                </Badge>
                <Badge variant="outline" className="bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                  <ServerCog className="w-3 h-3 mr-1" />
                  130 AIs integrated
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {org.name}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {greeting}, <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">{firstName}</span>
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                {isViewer
                  ? "You have read-only access to the Marq AI workspace. Browse provider health, failover history, and analytics below."
                  : isManager
                    ? "Your unified AI gateway is operational. Manage providers, invite teammates, and monitor real-time routing across every model."
                    : "Welcome to your AI workspace. Start a chat, run an agent, or compare model outputs — all routed through Marq's failover engine."}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!isViewer && (
                  <Button onClick={onNewChat} className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-md shadow-emerald-500/20">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New chat
                  </Button>
                )}
                <Button variant="outline" onClick={() => onNavigate("agent")}>
                  <Brain className="w-4 h-4 mr-1.5" />
                  Run an agent
                </Button>
                <Button variant="outline" onClick={() => onNavigate("directory")}>
                  <Network className="w-4 h-4 mr-1.5" />
                  Browse AI directory
                </Button>
                <Button variant="outline" onClick={() => onNavigate("unified-ai")}>
                  <ServerCog className="w-4 h-4 mr-1.5" />
                  Unified AI health
                </Button>
              </div>
            </div>

            {/* Mini live-topology infographic */}
            <div className="hidden lg:flex shrink-0 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Live topology
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Operational
                  </span>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
                      <Workflow className="w-5 h-5 text-white" strokeWidth={2.2} />
                    </div>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Marq</span>
                  </div>
                  <svg viewBox="0 0 100 50" className="w-full h-10" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="dash-line" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 25 Q 50 25 100 10" stroke="url(#dash-line)" strokeWidth="1.2" fill="none" strokeDasharray="3 2">
                      <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1.2s" repeatCount="indefinite" />
                    </path>
                    <path d="M 0 25 Q 50 25 100 25" stroke="url(#dash-line)" strokeWidth="1.2" fill="none" strokeDasharray="3 2" />
                    <path d="M 0 25 Q 50 25 100 40" stroke="url(#dash-line)" strokeWidth="1.2" fill="none" strokeDasharray="3 2" />
                  </svg>
                  <div className="flex flex-col gap-1">
                    {providers.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-[9px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-20">{p.displayName}</span>
                      </div>
                    ))}
                    {providers.length === 0 && (
                      <div className="text-[9px] text-slate-400 italic px-2">No providers yet</div>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Healthy</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{healthyCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Degraded</div>
                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{degradedCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-slate-500">Down</div>
                    <div className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">{downCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────── KPI tiles ───────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((k) => (
            <button
              key={k.label}
              onClick={k.onClick}
              className="group text-left"
            >
              <Card className="relative overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-slate-200 dark:border-slate-800 h-full">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.accent} flex items-center justify-center shadow-sm`}>
                      <k.icon className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-3 text-2xl md:text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {k.value}
                  </div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {k.label}
                  </div>
                  {k.hint && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {k.hint}
                    </div>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>

        {/* ───────── Two-column: quick actions + activity feed ───────── */}
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Quick actions — left, 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                {isViewer ? "Explore" : "Get to work"}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <QuickActionCard
                  icon={MessageSquare}
                  title="Chat"
                  description="Multi-turn conversations routed across every provider with automatic failover."
                  accent="from-emerald-500 to-teal-500"
                  onClick={() => onNavigate("chat")}
                  cta={!isViewer ? "Open chat" : "View chats"}
                />
                <QuickActionCard
                  icon={Brain}
                  title="Agents"
                  description="ReAct agents with tool use — Full-Stack Dev, Sales, DevOps, BA, PM and more."
                  accent="from-violet-500 to-fuchsia-500"
                  onClick={() => onNavigate("agent")}
                  cta={!isViewer ? "Run agent" : "View agents"}
                />
                <QuickActionCard
                  icon={GitCompare}
                  title="Compare models"
                  description="Run one prompt across N providers in parallel. See latency, tokens, and quality side-by-side."
                  accent="from-amber-500 to-orange-500"
                  onClick={() => onNavigate("compare")}
                  cta="Compare"
                />
                <QuickActionCard
                  icon={BookMarked}
                  title="Prompt library"
                  description="Curated, reusable prompts for engineering, sales, ops, and research."
                  accent="from-rose-500 to-pink-500"
                  onClick={() => onNavigate("prompts")}
                  cta="Browse"
                />
              </div>
            </div>

            {/* Manager-only: admin shortcuts */}
            {isManager && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
                  Admin
                </h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  <AdminMiniCard
                    icon={Users} title="Team"
                    description="Invite members, assign roles"
                    accent="text-blue-600 dark:text-blue-400"
                    onClick={() => onNavigate("org")}
                  />
                  <AdminMiniCard
                    icon={Key} title="API keys"
                    description="Issue scoped SaaS keys"
                    accent="text-violet-600 dark:text-violet-400"
                    onClick={() => onNavigate("apikeys")}
                  />
                  <AdminMiniCard
                    icon={BarChart3} title="Analytics"
                    description="7-day usage & health"
                    accent="text-emerald-600 dark:text-emerald-400"
                    onClick={() => onNavigate("analytics")}
                  />
                </div>
              </div>
            )}

            {/* Recent conversations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Recent conversations
                </h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate("chat")} className="text-xs">
                  View all
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
              {recentSessions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No conversations yet. {!isViewer && "Start a new chat to see it here."}
                    </p>
                    {!isViewer && (
                      <Button onClick={onNewChat} variant="outline" size="sm" className="mt-3">
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        New chat
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {recentSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onNavigate("chat")}
                      className="group text-left"
                    >
                      <Card className="hover:border-emerald-400 hover:shadow-sm transition-all p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {s.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {s.lastMessage || "No messages yet"}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="w-2.5 h-2.5" />
                                {s.messageCount}
                              </span>
                              <span>·</span>
                              <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-slate-500 transition-colors mt-1" />
                        </div>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: activity + system status */}
          <div className="space-y-4">
            {/* System status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    System status
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => onNavigate("health")} className="text-xs h-7 px-2">
                    Details
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Healthy
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{healthyCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Degraded
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{degradedCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    Down
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{downCount}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Avg latency</span>
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      {providers.some((p) => p.lastLatencyMs != null)
                        ? `${Math.round(
                            providers.filter((p) => p.lastLatencyMs != null).reduce((s, p) => s + (p.lastLatencyMs ?? 0), 0) /
                              Math.max(1, providers.filter((p) => p.lastLatencyMs != null).length),
                          )}ms`
                        : "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent failovers */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Recent failovers
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => onNavigate("failovers")} className="text-xs h-7 px-2">
                    All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentFailovers.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1.5" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No failovers — every request served by its primary provider.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentFailovers.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: f.fromProvider.color }}
                          title={f.fromProvider.displayName}
                        />
                        <span className="text-slate-400">→</span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: f.toProvider.color }}
                          title={f.toProvider.displayName}
                        />
                        <span className="text-slate-600 dark:text-slate-300 truncate flex-1">
                          {f.fromProvider.displayName} → {f.toProvider.displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(f.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top providers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-500" />
                  Top providers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {providers.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-3">
                    No providers configured.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {providers.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onNavigate("providers")}
                        className="w-full flex items-center gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-1 px-1 py-1 rounded-md transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              p.status === "healthy" ? "#10b981" :
                              p.status === "degraded" ? "#f59e0b" :
                              p.status === "down" ? "#ef4444" : "#6b7280",
                          }}
                        />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
                          {p.displayName}
                        </span>
                        {p.lastLatencyMs != null && (
                          <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                            {p.lastLatencyMs}ms
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Help card */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 border-slate-800 text-white">
              <CardContent className="p-4">
                <BookOpen className="w-5 h-5 text-emerald-400 mb-2" />
                <h3 className="text-sm font-semibold">New to Marq AI?</h3>
                <p className="text-xs text-slate-300 mt-1 mb-3">
                  Read the technical, functional, and SOP docs to get up to speed fast.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate("docs")}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Open docs
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------

function QuickActionCard({
  icon: Icon, title, description, accent, onClick, cta,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
  cta: string;
}) {
  return (
    <button onClick={onClick} className="group text-left">
      <Card className="relative overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-slate-200 dark:border-slate-800 h-full">
        <div className={`pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${accent} opacity-10 blur-2xl`} />
        <CardContent className="p-4 md:p-5 relative">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-sm shrink-0`}>
              <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {description}
              </p>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-3 group-hover:gap-1.5 transition-all">
                {cta}
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function AdminMiniCard({
  icon: Icon, title, description, accent, onClick,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group text-left">
      <Card className="hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all border-slate-200 dark:border-slate-800 h-full">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon className={`w-4 h-4 ${accent}`} />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            {description}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
