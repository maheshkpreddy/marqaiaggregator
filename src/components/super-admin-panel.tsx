"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, CheckCircle2, XCircle, Pause, Play, Loader2, Search, Building2,
  Users, Crown, Key, Activity, TrendingUp, AlertTriangle, Clock, Mail,
  Sparkles, RefreshCw, UserCheck, UserX, CreditCard, Settings2, Lock,
  Boxes, LayoutGrid, Save, RotateCcw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: "pending_approval" | "approved" | "rejected" | "suspended";
  rejectionReason: string | null;
  adminNote: string | null;
  planAssignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  seatsTotal: number;
  seatsUsed: number;
  counts: { members: number; sessions: number; apiKeys: number; customApis: number };
  owner: { id: string; email: string; name: string | null } | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  globalRole: "user" | "super_admin";
  isSuperAdmin: boolean;
  suspendedAt: string | null;
  createdAt: string;
  memberships: Array<{
    id: string;
    role: string;
    org: { id: string; name: string; slug: string; plan: string; status: string };
  }>;
}

interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthlyUsd: number;
  seatsIncluded: number;
  requestsPerMonth: number;
  features: string[];
  publicVisible: boolean;
  sortOrder: number;
  active: boolean;
}

// ── Module Access types (per-org module overrides) ──────────────
interface ModuleDef {
  key: string;
  label: string;
  group: "Build" | "Discover" | "Settings" | "Help" | "System";
  description: string;
  alwaysOn?: boolean;
}

interface ModuleOverride {
  moduleKey: string;
  enabled: boolean;
  note: string | null;
}

interface ModuleAccessConfig {
  catalog: ModuleDef[];
  planCode: string;
  planName: string;
  planFeatures: string[];
  alwaysOn: string[];
  overrides: ModuleOverride[];
  effective: string[];
}

interface Stats {
  orgs: { total: number; pending: number; approved: number; rejected: number; suspended: number };
  users: { total: number; superAdmins: number; suspended: number };
  activity: { chatSessions: number; agentTasks: number; apiKeys: number; customApis: number };
  planDistribution: Record<string, number>;
}

// ── Helpers ──────────────────────────────────────────────────────

const statusMeta: Record<OrgRow["status"], { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending_approval: { label: "Pending", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40", icon: Clock },
  approved: { label: "Approved", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/40", icon: XCircle },
  suspended: { label: "Suspended", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-200 dark:bg-slate-700", icon: Pause },
};

const planLabel: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Professional",
  enterprise: "Enterprise",
  custom: "Custom",
};

const planColor: Record<string, string> = {
  free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pro: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  custom: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
};

function formatUsd(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ────────────────────────────────────────────────────

export function SuperAdminPanel() {
  const [tab, setTab] = useState<"overview" | "approvals" | "orgs" | "users" | "plans">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [orgFilter, setOrgFilter] = useState<string>("pending_approval");
  const [orgSearch, setOrgSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Review dialog: opened when the admin clicks "Review" on a pending org.
  const [reviewOrg, setReviewOrg] = useState<OrgRow | null>(null);
  const [reviewPlan, setReviewPlan] = useState("free");
  const [reviewSeats, setReviewSeats] = useState(5);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Module Access inline panel: rendered directly inside the Organizations
  // tab when the admin clicks "Modules" on any org. Lets the super admin
  // grant or revoke individual modules per company, overriding the plan's
  // default feature set.
  const [moduleOrg, setModuleOrg] = useState<OrgRow | null>(null);
  const [moduleConfig, setModuleConfig] = useState<ModuleAccessConfig | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleSaving, setModuleSaving] = useState(false);
  // Local edits: Map<moduleKey, { enabled, note }> — committed on Save.
  const [moduleEdits, setModuleEdits] = useState<Map<string, { enabled: boolean; note: string }>>(new Map());

  const { toast } = useToast();

  // ── Loaders ────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/stats");
      if (!r.ok) return;
      setStats(await r.json());
    } catch {}
  }, []);

  const loadOrgs = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (orgFilter !== "all") qs.set("status", orgFilter);
      if (orgSearch.trim()) qs.set("q", orgSearch.trim());
      const r = await fetch(`/api/admin/orgs?${qs}`);
      if (!r.ok) return;
      const d = await r.json();
      setOrgs(d.orgs);
    } catch {}
  }, [orgFilter, orgSearch]);

  const loadUsers = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (userSearch.trim()) qs.set("q", userSearch.trim());
      const r = await fetch(`/api/admin/users?${qs}`);
      if (!r.ok) return;
      const d = await r.json();
      setUsers(d.users);
    } catch {}
  }, [userSearch]);

  const loadPlans = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/plans");
      if (!r.ok) return;
      const d = await r.json();
      setPlans(d.plans);
    } catch {}
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadOrgs(), loadUsers(), loadPlans()]);
    setLoading(false);
  }, [loadStats, loadOrgs, loadUsers, loadPlans]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // Re-load orgs when filter/search changes.
  useEffect(() => { loadOrgs(); }, [loadOrgs]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Actions ────────────────────────────────────────────────────

  async function patchOrg(orgId: string, body: Record<string, unknown>, successMsg: string) {
    setActionLoading(orgId);
    try {
      const r = await fetch(`/api/admin/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");
      toast({ title: "Success", description: successMsg });
      await Promise.all([loadOrgs(), loadStats()]);
      return true;
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function patchUser(userId: string, body: Record<string, unknown>, successMsg: string) {
    setActionLoading(userId);
    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");
      toast({ title: "Success", description: successMsg });
      await loadUsers();
      return true;
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function approveOrg() {
    if (!reviewOrg) return;
    const ok = await patchOrg(
      reviewOrg.id,
      {
        status: "approved",
        plan: reviewPlan,
        seatsTotal: reviewSeats,
        adminNote: reviewNote.trim() || undefined,
      },
      `Approved ${reviewOrg.name} on the ${planLabel[reviewPlan] ?? reviewPlan} plan.`,
    );
    if (ok) {
      setReviewOrg(null);
      setReviewPlan("free");
      setReviewSeats(5);
      setReviewNote("");
    }
  }

  async function rejectOrg() {
    if (!reviewOrg) return;
    const ok = await patchOrg(
      reviewOrg.id,
      { status: "rejected", rejectionReason: rejectReason.trim() || "Not specified" },
      `Rejected ${reviewOrg.name}.`,
    );
    if (ok) {
      setReviewOrg(null);
      setRejectReason("");
    }
  }

  // ── Module Access inline panel ─────────────────────────────────
  // Loads the per-org module config (catalog + plan features + overrides +
  // effective set) and seeds the local edits map with the current state.
  // The panel itself is rendered inline inside the org row (no popup).
  async function openModulePanel(org: OrgRow) {
    setModuleOrg(org);
    setModuleConfig(null);
    setModuleEdits(new Map());
    setModuleLoading(true);
    try {
      const r = await fetch(`/api/admin/orgs/${org.id}/modules`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Failed to load module config");
      }
      const cfg: ModuleAccessConfig = await r.json();
      setModuleConfig(cfg);
      // Seed local edits with current override state.
      const seed = new Map<string, { enabled: boolean; note: string }>();
      const planFeaturesSet = new Set(cfg.planFeatures.length === 0 ? cfg.catalog.map((m) => m.key) : cfg.planFeatures);
      for (const m of cfg.catalog) {
        const override = cfg.overrides.find((o) => o.moduleKey === m.key);
        const enabled = m.alwaysOn ? true : (override ? override.enabled : planFeaturesSet.has(m.key));
        const note = override?.note ?? "";
        seed.set(m.key, { enabled, note });
      }
      setModuleEdits(seed);
    } catch (err) {
      toast({
        title: "Could not load module config",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      setModuleOrg(null);
    } finally {
      setModuleLoading(false);
    }
  }

  function toggleModuleEdit(key: string, enabled: boolean) {
    setModuleEdits((prev) => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { enabled: false, note: "" };
      next.set(key, { ...cur, enabled });
      return next;
    });
  }

  function setModuleNoteEdit(key: string, note: string) {
    setModuleEdits((prev) => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { enabled: false, note: "" };
      next.set(key, { ...cur, note });
      return next;
    });
  }

  // Reset all toggles back to the plan default (clears all overrides).
  function resetModuleEditsToPlanDefault() {
    if (!moduleConfig) return;
    const seed = new Map<string, { enabled: boolean; note: string }>();
    const planFeaturesSet = new Set(
      moduleConfig.planFeatures.length === 0
        ? moduleConfig.catalog.map((m) => m.key)
        : moduleConfig.planFeatures,
    );
    for (const m of moduleConfig.catalog) {
      const enabled = m.alwaysOn ? true : planFeaturesSet.has(m.key);
      seed.set(m.key, { enabled, note: "" });
    }
    setModuleEdits(seed);
    toast({ title: "Reset to plan defaults", description: "Click Save to commit." });
  }

  async function saveModuleAccess() {
    if (!moduleOrg || !moduleConfig) return;
    setModuleSaving(true);
    try {
      const modules = Array.from(moduleEdits.entries()).map(([moduleKey, v]) => ({
        moduleKey,
        enabled: v.enabled,
        note: v.note.trim() || undefined,
      }));
      const r = await fetch(`/api/admin/orgs/${moduleOrg.id}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed");
      toast({
        title: "Module access updated",
        description: `${moduleOrg.name} — ${d.effective?.length ?? 0} modules enabled.`,
      });
      setModuleOrg(null);
      setModuleConfig(null);
      setModuleEdits(new Map());
      // Refresh orgs so any badge hint can update.
      await loadOrgs();
    } catch (err) {
      toast({
        title: "Could not save module access",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setModuleSaving(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────

  const pendingOrgs = orgs.filter((o) => o.status === "pending_approval");
  const pendingCount = stats?.orgs.pending ?? 0;

  // ── Render ─────────────────────────────────────────────────────

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Super Admin Console</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform-wide control: approve tenants, assign plans, manage users.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reloadAll} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Building2}
          label="Organizations"
          value={stats?.orgs.total ?? 0}
          sub={`${stats?.orgs.approved ?? 0} approved`}
          accent="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={Clock}
          label="Pending Approval"
          value={pendingCount}
          sub={pendingCount > 0 ? "Action required" : "All caught up"}
          accent="from-amber-500 to-orange-500"
          alert={pendingCount > 0}
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.users.total ?? 0}
          sub={`${stats?.users.superAdmins ?? 0} super admins`}
          accent="from-violet-500 to-fuchsia-500"
        />
        <StatCard
          icon={Activity}
          label="Chat Sessions"
          value={stats?.activity.chatSessions ?? 0}
          sub={`${stats?.activity.customApis ?? 0} custom APIs`}
          accent="from-emerald-500 to-teal-500"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="approvals" className="text-xs relative">
            Approvals
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orgs" className="text-xs">Organizations</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
          <TabsTrigger value="plans" className="text-xs">Plans</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Plan Distribution
                </CardTitle>
                <CardDescription className="text-xs">Across approved organizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats && Object.entries(stats.planDistribution).length > 0 ? (
                  Object.entries(stats.planDistribution).map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className={planColor[plan] ?? ""}>
                        {planLabel[plan] ?? plan}
                      </Badge>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No approved orgs yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Needs Attention
                </CardTitle>
                <CardDescription className="text-xs">Items requiring super admin action</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <ActionRow
                  icon={Clock}
                  label="Pending org approvals"
                  count={pendingCount}
                  onClick={() => setTab("approvals")}
                  accent="text-amber-600 dark:text-amber-400"
                />
                <ActionRow
                  icon={Pause}
                  label="Suspended orgs"
                  count={stats?.orgs.suspended ?? 0}
                  onClick={() => { setOrgFilter("suspended"); setTab("orgs"); }}
                  accent="text-slate-600 dark:text-slate-400"
                />
                <ActionRow
                  icon={UserX}
                  label="Suspended users"
                  count={stats?.users.suspended ?? 0}
                  onClick={() => setTab("users")}
                  accent="text-red-600 dark:text-red-400"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── APPROVALS ── */}
        <TabsContent value="approvals" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Company Registrations
              </CardTitle>
              <CardDescription className="text-xs">
                Review each new company signup. Approve with a subscription plan, or reject with a reason.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOrgs.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                  No pending registrations. All caught up!
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOrgs.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="font-semibold truncate">{o.name}</span>
                            <Badge variant="outline" className={statusMeta[o.status].bg + " " + statusMeta[o.status].color}>
                              {statusMeta[o.status].label}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 ml-6">
                            {o.owner && (
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3" />
                                <span>{o.owner.email}</span>
                                {o.owner.name && <span className="text-slate-400">· {o.owner.name}</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              <span>Submitted {formatDate(o.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewOrg(o);
                            setReviewPlan("free");
                            setReviewSeats(5);
                            setReviewNote("");
                            setRejectReason("");
                          }}
                          disabled={actionLoading === o.id}
                          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                        >
                          {actionLoading === o.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ORGANIZATIONS ── */}
        <TabsContent value="orgs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    All Organizations
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Manage any tenant on the platform. Change plan, suspend, or reject.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Search orgs..."
                      className="pl-8 h-8 w-48 text-xs"
                    />
                  </div>
                  <Select value={orgFilter} onValueChange={setOrgFilter}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending_approval">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {orgs.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">
                  No organizations match this filter.
                </div>
              ) : (
                <div className="space-y-2">
                  {orgs.map((o) => {
                    const StatusIcon = statusMeta[o.status].icon;
                    return (
                      <div
                        key={o.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">{o.name}</span>
                              <Badge variant="outline" className={`text-[10px] ${statusMeta[o.status].bg} ${statusMeta[o.status].color}`}>
                                <StatusIcon className="w-2.5 h-2.5 mr-1" />
                                {statusMeta[o.status].label}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${planColor[o.plan] ?? ""}`}>
                                {planLabel[o.plan] ?? o.plan}
                              </Badge>
                              <span className="text-[10px] text-slate-500">
                                {o.seatsUsed}/{o.seatsTotal} seats
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                              {o.owner && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{o.owner.email}</span>}
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{o.counts.members} members</span>
                              <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{o.counts.sessions} sessions</span>
                              <span className="flex items-center gap-1"><Key className="w-3 h-3" />{o.counts.apiKeys} keys</span>
                              {o.rejectionReason && (
                                <span className="text-red-500">· Rejected: {o.rejectionReason}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm" variant="outline"
                              className={`h-7 text-xs ${moduleOrg?.id === o.id ? "bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300" : ""}`}
                              onClick={() => moduleOrg?.id === o.id ? setModuleOrg(null) : openModulePanel(o)}
                              disabled={actionLoading === o.id}
                              title="Configure which modules this company can access"
                            >
                              <LayoutGrid className="w-3 h-3 mr-1" />{moduleOrg?.id === o.id ? "Hide Modules" : "Modules"}
                            </Button>
                            {o.status === "pending_approval" && (
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setReviewOrg(o);
                                  setReviewPlan(o.plan);
                                  setReviewSeats(o.seatsTotal);
                                  setReviewNote(o.adminNote ?? "");
                                  setRejectReason("");
                                }}
                                disabled={actionLoading === o.id}
                              >
                                <Shield className="w-3 h-3 mr-1" />Review
                              </Button>
                            )}
                            {o.status === "approved" && (
                              <>
                                <Select
                                  value={o.plan}
                                  onValueChange={(plan) => patchOrg(o.id, { plan }, `Plan changed to ${planLabel[plan] ?? plan}`)}
                                >
                                  <SelectTrigger className="h-7 w-32 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {plans.map((p) => (
                                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
                                  onClick={() => patchOrg(o.id, { status: "suspended" }, "Organization suspended.")}
                                  disabled={actionLoading === o.id}
                                  title="Suspend"
                                >
                                  <Pause className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            {(o.status === "suspended" || o.status === "rejected") && (
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs"
                                onClick={() => patchOrg(o.id, { status: "approved" }, "Organization re-approved.")}
                                disabled={actionLoading === o.id}
                              >
                                <Play className="w-3 h-3 mr-1" />Restore
                              </Button>
                            )}
                          </div>
                        </div>

                      {/* ── Inline Module Access panel ── */}
                      {/* Expanded directly inside the Organizations tab (no popup).
                          Uses a native scrolling div (overflow-y-auto) because the
                          shadcn ScrollArea primitive was not scrolling reliably
                          inside the previous Dialog. */}
                      {moduleOrg?.id === o.id && (
                        <ModuleInlinePanel
                          org={moduleOrg}
                          config={moduleConfig}
                          loading={moduleLoading}
                          saving={moduleSaving}
                          edits={moduleEdits}
                          onToggle={toggleModuleEdit}
                          onNote={setModuleNoteEdit}
                          onReset={resetModuleEditsToPlanDefault}
                          onSave={saveModuleAccess}
                          onClose={() => setModuleOrg(null)}
                        />
                      )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── USERS ── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-500" />
                    All Users
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Promote super admins, suspend abusive accounts.
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="pl-8 h-8 w-48 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">No users found.</div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className={`text-[10px] font-semibold ${
                              u.isSuperAdmin
                                ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                                : u.suspendedAt
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-slate-200 dark:bg-slate-700"
                            }`}>
                              {(u.name || u.email).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">{u.name || u.email.split("@")[0]}</span>
                              {u.isSuperAdmin && (
                                <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                  <Crown className="w-2.5 h-2.5 mr-1" />Super Admin
                                </Badge>
                              )}
                              {u.suspendedAt && (
                                <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                  <Pause className="w-2.5 h-2.5 mr-1" />Suspended
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {u.email} · joined {formatDate(u.createdAt)}
                            </div>
                            {u.memberships.length > 0 && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {u.memberships.map((m) => (
                                  <span key={m.id} className="mr-2">
                                    {m.org.name} ({m.role})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {u.isSuperAdmin ? (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-amber-600 hover:text-amber-700"
                              onClick={() => patchUser(u.id, { globalRole: "user" }, "Demoted to regular user.")}
                              disabled={actionLoading === u.id}
                              title="Remove super admin"
                            >
                              <Crown className="w-3 h-3 mr-1" />Demote
                            </Button>
                          ) : (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-violet-600 hover:text-violet-700"
                              onClick={() => patchUser(u.id, { globalRole: "super_admin" }, "Promoted to super admin.")}
                              disabled={actionLoading === u.id}
                              title="Promote to super admin"
                            >
                              <Shield className="w-3 h-3 mr-1" />Promote
                            </Button>
                          )}
                          {u.suspendedAt ? (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                              onClick={() => patchUser(u.id, { suspend: false }, "User reinstated.")}
                              disabled={actionLoading === u.id}
                              title="Reinstate user"
                            >
                              <UserCheck className="w-3 h-3 mr-1" />Reinstate
                            </Button>
                          ) : (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-red-600 hover:text-red-700"
                              onClick={() => patchUser(u.id, { suspend: true }, "User suspended. All sessions revoked.")}
                              disabled={actionLoading === u.id}
                              title="Suspend user"
                            >
                              <UserX className="w-3 h-3 mr-1" />Suspend
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PLANS ── */}
        <TabsContent value="plans" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                Subscription Plan Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Pricing strategy reference. New orgs are assigned one of these plans during approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">No plans configured.</div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-xl border p-4 ${
                        p.code === "enterprise"
                          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10"
                          : p.code === "custom"
                          ? "border-fuchsia-300 dark:border-fuchsia-700 bg-fuchsia-50 dark:bg-fuchsia-900/10"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm">{p.name}</span>
                        {!p.publicVisible && (
                          <Badge variant="outline" className="text-[10px]">
                            <Lock className="w-2.5 h-2.5 mr-1" />Private
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold tracking-tight">
                        {formatUsd(p.priceMonthlyUsd)}
                        {p.priceMonthlyUsd > 0 && <span className="text-xs font-normal text-slate-500">/mo</span>}
                      </div>
                      {p.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{p.description}</p>
                      )}
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Seats</span>
                          <span className="font-semibold">{p.seatsIncluded}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Requests/mo</span>
                          <span className="font-semibold">{p.requestsPerMonth === 0 ? "Unlimited" : p.requestsPerMonth.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Features</span>
                          <span className="font-semibold">
                            {p.features.length === 0 ? "All" : p.features.length}
                          </span>
                        </div>
                      </div>
                      {p.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {p.features.map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px] capitalize">{f}</Badge>
                          ))}
                        </div>
                      )}
                      {stats?.planDistribution[p.code] !== undefined && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-slate-500">Active orgs: </span>
                          <span className="font-semibold">{stats.planDistribution[p.code]}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Review dialog ── */}
      <Dialog open={!!reviewOrg} onOpenChange={(o) => !o && setReviewOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-500" />
              Review Organization
            </DialogTitle>
            <DialogDescription>
              Approve <strong>{reviewOrg?.name}</strong> with a subscription plan, or reject with a reason.
            </DialogDescription>
          </DialogHeader>

          {reviewOrg && (
            <div className="space-y-4">
              {/* Org summary */}
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs space-y-1">
                {reviewOrg.owner && (
                  <div><span className="text-slate-500">Owner:</span> <span className="font-medium">{reviewOrg.owner.email}</span></div>
                )}
                <div><span className="text-slate-500">Submitted:</span> <span className="font-medium">{formatDate(reviewOrg.createdAt)}</span></div>
                <div><span className="text-slate-500">Current plan:</span> <span className="font-medium capitalize">{planLabel[reviewOrg.plan] ?? reviewOrg.plan}</span></div>
                <div><span className="text-slate-500">Current seats:</span> <span className="font-medium">{reviewOrg.seatsTotal}</span></div>
              </div>

              {/* Approval config */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Subscription plan to assign</Label>
                  <Select value={reviewPlan} onValueChange={setReviewPlan}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name} — {formatUsd(p.priceMonthlyUsd)}/mo · {p.seatsIncluded} seats
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Seats included</Label>
                  <Input
                    type="number" min={1} max={100000}
                    value={reviewSeats}
                    onChange={(e) => setReviewSeats(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Admin note (optional)</Label>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Internal note, e.g. 'VIP customer, negotiated custom rate.'"
                    className="mt-1 text-xs"
                    rows={2}
                  />
                </div>
              </div>

              {/* Reject expander */}
              <details className="text-xs">
                <summary className="cursor-pointer text-red-600 hover:text-red-700 font-medium">
                  Reject this organization instead →
                </summary>
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (shown to the user on login attempt)."
                    rows={2}
                  />
                  <Button
                    size="sm" variant="destructive"
                    onClick={rejectOrg}
                    disabled={actionLoading === reviewOrg.id || !rejectReason.trim()}
                    className="w-full"
                  >
                    {actionLoading === reviewOrg.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                    Reject organization
                  </Button>
                </div>
              </details>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOrg(null)}>Cancel</Button>
            <Button
              onClick={approveOrg}
              disabled={actionLoading === reviewOrg?.id}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
            >
              {actionLoading === reviewOrg?.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Approve & Assign Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Module Access inline panel (rendered inside the Organizations tab) ──
// Replaces the previous Dialog popup. Uses a native overflow-y-auto div
// (instead of shadcn ScrollArea) so the scroll-down works reliably across
// browsers and inside flex/grid containers.

interface ModuleInlinePanelProps {
  org: OrgRow;
  config: ModuleAccessConfig | null;
  loading: boolean;
  saving: boolean;
  edits: Map<string, { enabled: boolean; note: string }>;
  onToggle: (key: string, enabled: boolean) => void;
  onNote: (key: string, note: string) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
}

function ModuleInlinePanel({
  org, config, loading, saving, edits,
  onToggle, onNote, onReset, onSave, onClose,
}: ModuleInlinePanelProps) {
  const enabledCount = Array.from(edits.values()).filter((v) => v.enabled).length;
  const disabledCount = edits.size - enabledCount;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-violet-500" />
          <div>
            <div className="text-sm font-semibold">
              Module Access — {org.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Grant or revoke individual modules for this company. Plan:{" "}
              <strong>{config?.planName ?? org.plan}</strong>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm" variant="ghost"
            className="h-7 text-xs"
            onClick={onReset}
            disabled={saving || !config}
            title="Reset all toggles to the plan's default feature set"
          >
            <RotateCcw className="w-3 h-3 mr-1" />Reset to plan
          </Button>
          <Button
            size="sm" variant="ghost"
            className="h-7 text-xs"
            onClick={onClose}
            disabled={saving}
            title="Collapse module panel"
          >
            Close
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && config && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {edits.size} total modules
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {enabledCount} enabled
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {disabledCount} disabled
              </Badge>
              <span className="text-slate-500 dark:text-slate-400">
                Plan default: {config.planFeatures.length === 0 ? "all modules" : `${config.planFeatures.length} modules`}
              </span>
            </div>
          </div>

          {/* Module list grouped by group — native scrolling div.
              Replaced the previous <ScrollArea/> which did not scroll
              reliably inside the Dialog. The explicit max-h + overflow-y-auto
              makes the panel scrollable in all browsers. */}
          <div className="overflow-y-auto max-h-[60vh] pr-1 -mr-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="space-y-4 p-3">
              {(["System", "Build", "Discover", "Settings", "Help"] as const).map((groupName) => {
                const groupModules = config.catalog.filter((m) => m.group === groupName);
                if (groupModules.length === 0) return null;
                return (
                  <div key={groupName} className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold px-1">
                      {groupName}
                    </div>
                    {groupModules.map((m) => {
                      const edit = edits.get(m.key);
                      const isEnabled = edit?.enabled ?? false;
                      const planFeaturesSet = new Set(
                        config.planFeatures.length === 0
                          ? config.catalog.map((mm) => mm.key)
                          : config.planFeatures,
                      );
                      const planDefault = m.alwaysOn ? true : planFeaturesSet.has(m.key);
                      const isOverride = isEnabled !== planDefault || !!edit?.note;
                      return (
                        <div
                          key={m.key}
                          className={`rounded-lg border px-3 py-2 transition-colors ${
                            isEnabled
                              ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-900/10"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{m.label}</span>
                                <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {m.key}
                                </code>
                                {m.alwaysOn && (
                                  <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                                    <Lock className="w-2.5 h-2.5 mr-0.5" />Always on
                                  </Badge>
                                )}
                                {isOverride && !m.alwaysOn && (
                                  <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                                    Override
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {m.description}
                              </p>
                              <Input
                                value={edit?.note ?? ""}
                                onChange={(e) => onNote(m.key, e.target.value)}
                                placeholder="Optional note (e.g. why granted or revoked)"
                                disabled={saving || m.alwaysOn}
                                className="h-7 mt-1.5 text-[11px]"
                              />
                            </div>
                            <div className="shrink-0 pt-0.5">
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(v) => onToggle(m.key, v)}
                                disabled={saving || m.alwaysOn}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-end gap-2 mt-3">
            <span className="text-[11px] text-slate-500 mr-auto">
              Changes are local until you click Save.
            </span>
            <Button
              onClick={onSave}
              disabled={saving || loading || !config}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white h-8"
              size="sm"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Module Access
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Small sub-components ─────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent, alert,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  sub: string;
  accent: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-amber-300 dark:border-amber-700" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          {alert && value > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({
  icon: Icon, label, count, onClick, accent,
}: {
  icon: typeof Building2;
  label: string;
  count: number;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      <span className="flex items-center gap-2 text-sm">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        {label}
      </span>
      <span className={`text-sm font-semibold ${count > 0 ? accent : "text-slate-400"}`}>{count}</span>
    </button>
  );
}
