"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  Zap,
  Activity,
  Settings2,
  Shield,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Loader2,
  Sparkles,
  Bot,
  Cpu,
  Layers,
  Pencil,
  ChevronUp,
  ChevronDown,
  CircleDot,
  Brain,
  Wrench,
  Play,
  RefreshCw,
  Search,
  Calculator,
  FileText,
  Timer,
  ChevronRight,
  Code2,
  FlaskConical,
  ClipboardList,
  TrendingUp,
  Compass,
  GitCompare,
  BookMarked,
  Users,
  Key,
  LogOut,
  Building2,
  BookOpen,
} from "lucide-react";
import { AuthScreen } from "@/components/auth-screen";
import { OrganizationPanel } from "@/components/org-panel";
import { ApiKeysPanel } from "@/components/api-keys-panel";
import { ComparePanel } from "@/components/compare-panel";
import { PromptsPanel } from "@/components/prompts-panel";
import { ProviderGuidePanel } from "@/components/provider-guide-panel";
import { AgentPanel } from "@/components/agent-panel";

// ---------- Auth types ----------
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}
interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
}
interface Membership {
  id: string;
  role: string;
  org: AuthOrg;
}

// ---------- Types ----------
interface Provider {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  apiEndpoint: string | null;
  hasApiKey: boolean;
  models: string[];
  active: boolean;
  priority: number;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastLatencyMs: number | null;
  lastError: string | null;
  lastCheckedAt: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  latencyMs?: number | null;
  tokensUsed?: number | null;
  failedOver?: boolean;
  originalProviderId?: string | null;
  createdAt: string;
  provider?: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    icon: string;
  } | null;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
}

interface ChatResponse {
  message: {
    id: string;
    role: string;
    content: string;
    latencyMs: number | null;
    tokensUsed: number | null;
    failedOver: boolean;
    createdAt: string;
  };
  provider: { id: string; name: string; displayName: string; color: string; icon: string };
  originalProvider?: { id: string; name: string; displayName: string; color: string; icon: string } | null;
  model: string;
  attempts: Array<{
    providerId: string;
    providerName: string;
    success: boolean;
    reason?: string;
    errorMessage?: string;
    latencyMs?: number;
    skipped?: boolean;
  }>;
  failedOver: boolean;
  fallback?: boolean;
  sessionId: string;
  userMessageId: string;
}

interface FailoverLog {
  id: string;
  reason: string;
  errorMessage: string | null;
  sessionId: string | null;
  createdAt: string;
  fromProvider: { id: string; name: string; displayName: string; color: string };
  toProvider: { id: string; name: string; displayName: string; color: string };
}

interface AgentTool {
  name: string;
  description: string;
  signature: string;
  examples?: string[];
}

type AgentTemplateCategory =
  | "engineering"
  | "business"
  | "operations"
  | "general"
  | "agent_arch"
  | "marq_products"
  | "sales"
  | "consulting"
  | "security"
  | "marketing"
  | "strategy"
  | "sports";

interface AgentTemplate {
  key: string;
  displayName: string;
  tagline: string;
  description: string;
  /** Lucide icon name OR a single-emoji string rendered directly. */
  icon: string;
  color: string;
  category: AgentTemplateCategory;
  defaultMaxSteps: number;
  tools: AgentTool[];
  suggestedGoals: string[];
}

interface AgentStep {
  id: string;
  stepNumber: number;
  thought: string | null;
  action: string | null;
  actionInput: string | null;
  observation: string | null;
  providerId: string | null;
  model: string | null;
  latencyMs: number | null;
  tokensUsed: number | null;
  failedOver: boolean;
  errorMessage: string | null;
  createdAt: string;
  provider?: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    icon: string;
  } | null;
}

interface AgentTask {
  id: string;
  title: string;
  goal: string;
  agentType: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  maxSteps: number;
  primaryProviderId: string | null;
  finalAnswer: string | null;
  errorMessage: string | null;
  totalLatencyMs: number | null;
  totalTokensUsed: number | null;
  failedOverCount: number;
  stepCount: number;
  lastAction: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgentTaskFull extends AgentTask {
  steps: AgentStep[];
}

// ---------- Helpers ----------
const statusMeta: Record<Provider["status"], { label: string; color: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy", color: "#10b981", icon: CheckCircle2 },
  degraded: { label: "Degraded", color: "#f59e0b", icon: AlertTriangle },
  down: { label: "Down", color: "#ef4444", icon: XCircle },
  unknown: { label: "Unknown", color: "#6b7280", icon: CircleDot },
};

function ProviderIcon({ icon, color, size = 16 }: { icon: string; color: string; size?: number }) {
  // Simple branded icons rendered as SVG glyphs.
  const common = { width: size, height: size, fill: color, viewBox: "0 0 24 24" };
  switch (icon) {
    case "openai":
      return (
        <svg {...common} xmlns="http://www.w3.org/2000/svg">
          <path d="M22.28 9.82a5.96 5.96 0 0 0-.51-4.91 6.04 6.04 0 0 0-6.5-2.9A6.06 6.06 0 0 0 4.98 4.18a5.96 5.96 0 0 0-3.99 2.9 6.04 6.04 0 0 0 .74 7.02 5.96 5.96 0 0 0 .51 4.91 6.04 6.04 0 0 0 6.5 2.9A5.96 5.96 0 0 0 13.5 24a6.04 6.04 0 0 0 5.77-4.18 5.96 5.96 0 0 0 3.99-2.9 6.04 6.04 0 0 0-.98-7.1zM13.5 22.43a4.48 4.48 0 0 1-2.87-1.03l.14-.08 4.78-2.77a.78.78 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.06v5.6a4.5 4.5 0 0 1-4.5 4.47zM3.6 18.32a4.46 4.46 0 0 1-.53-3l.14.08 4.78 2.77a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.07.07 0 0 1-.03.07L9.74 20a4.5 4.5 0 0 1-6.14-1.68zM2.34 8.32a4.5 4.5 0 0 1 2.36-1.98v5.7a.78.78 0 0 0 .39.68l5.8 3.36-2.02 1.17a.08.08 0 0 1-.07 0L4 14.5a4.5 4.5 0 0 1-1.66-6.18zm14.84 3.46L11.34 8.4l2.02-1.16a.07.07 0 0 1 .07 0L17.96 9.9a4.5 4.5 0 0 1-.67 8.12v-5.7a.78.78 0 0 0-.39-.68zm2.01-3.04l-.14-.09L14.27 5.9a.78.78 0 0 0-.79 0L7.64 9.27V6.94a.07.07 0 0 1 .03-.07L12.24 4a4.5 4.5 0 0 1 6.67 4.66zM6.49 12.94l-2.02-1.17a.08.08 0 0 1-.04-.06V6.13A4.5 4.5 0 0 1 11.99 2L9.18 3.62a.78.78 0 0 0-.4.68v6.74l-2.3 1.9zm1.1-2.37L9.62 9.4v3.46l-2.03-1.29z" />
        </svg>
      );
    case "gemini":
      return (
        <svg {...common} xmlns="http://www.w3.org/2000/svg">
          <path d="M12 24A14.6 14.6 0 0 0 0 12a14.6 14.6 0 0 0 12-12 14.6 14.6 0 0 0 12 12A14.6 14.6 0 0 0 12 24z" />
        </svg>
      );
    case "claude":
      return (
        <svg {...common} xmlns="http://www.w3.org/2000/svg">
          <path d="M4.7 20.34h2.7l.93-2.18H8.1l3.9-9.36 3.9 9.36h.07l-2.94-9.5a3.27 3.27 0 0 0-3.06-2.27h-.05a3.27 3.27 0 0 0-3.06 2.27l-2.16 6.05zm10.6 0h2.7L13.07 8.27a3.27 3.27 0 0 1 1.39 1.93l3.66 10.14z" />
        </svg>
      );
    default:
      return <Bot size={size} color={color} />;
  }
}

const reasonLabel: Record<string, string> = {
  timeout: "Timeout",
  rate_limit: "Rate Limit",
  auth_error: "Auth Error",
  server_error: "Server Error",
  network: "Network",
  unknown: "Unknown",
};

// ---------- Main Page ----------
export default function Home() {
  // ── Auth state ──
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authOrg, setAuthOrg] = useState<AuthOrg | null>(null);
  const [authRole, setAuthRole] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  // ── App state ──
  const [tab, setTab] = useState<"chat" | "compare" | "prompts" | "agent" | "providers" | "health" | "failovers" | "org" | "apikeys" | "guide">("chat");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [failovers, setFailovers] = useState<FailoverLog[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [primaryProviderId, setPrimaryProviderId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // --- Auth bootstrap ---
  // Check whether the user has a session cookie. If yes, populate authUser/org.
  // If no, the AuthScreen is rendered instead of the app.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user && data.org) {
          setAuthUser(data.user);
          setAuthOrg(data.org);
          setAuthRole(data.role);
          setMemberships(data.memberships ?? []);
        } else {
          setAuthUser(null);
        }
      } catch {
        setAuthUser(null);
      } finally {
        setAuthChecking(false);
      }
    })();
  }, []);

  // --- Data loaders (only run when authenticated) ---
  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }, []);

  const loadProviders = useCallback(async () => {
    const res = await fetch("/api/providers");
    const data = await res.json();
    const list: Provider[] = data.providers ?? [];
    setProviders(list);
    // Default to "Auto" (null) so the server picks the healthiest provider.
    // The user can still pin a specific provider by clicking it.
  }, []);

  const loadFailovers = useCallback(async () => {
    const res = await fetch("/api/failovers?limit=50");
    const data = await res.json();
    setFailovers(data.failovers ?? []);
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadSessions();
    loadProviders();
    loadFailovers();
  }, [authUser, loadSessions, loadProviders, loadFailovers]);

  // --- Auth actions ---
  async function handleAuthSuccess(data: {
    user: AuthUser;
    org: AuthOrg;
  }) {
    setAuthUser(data.user);
    setAuthOrg(data.org);
    setAuthRole("owner");
    // Refresh the me endpoint to get the full memberships list
    try {
      const res = await fetch("/api/auth/me");
      const d = await res.json();
      if (d.memberships) setMemberships(d.memberships);
    } catch {}
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthUser(null);
    setAuthOrg(null);
    setAuthRole(null);
    setMemberships([]);
    setSessions([]);
    setMessages([]);
    setActiveSessionId(null);
    setTab("chat");
  }

  async function handleSwitchOrg(orgId: string) {
    try {
      const res = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to switch org");
      setAuthOrg(d.org);
      const m = memberships.find((mm) => mm.org.id === d.org.id);
      setAuthRole(m?.role ?? "member");
      setOrgMenuOpen(false);
      // Reload org-scoped data
      setSessions([]);
      setMessages([]);
      setActiveSessionId(null);
      setTab("chat");
      setTimeout(() => {
        loadSessions();
        loadFailovers();
      }, 100);
      toast({ title: `Switched to ${d.org.name}` });
    } catch (err) {
      toast({
        title: "Could not switch org",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  // Refresh the relevant data whenever the user switches to a tab.
  // The Chat tab is already kept live by per-session message loading, so
  // we only need to refresh on Providers / Health / Failover Log.
  useEffect(() => {
    if (tab === "failovers") loadFailovers();
    if (tab === "health") loadProviders();
    if (tab === "providers") loadProviders();
  }, [tab, loadFailovers, loadProviders]);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
    else setMessages([]);
  }, [activeSessionId, loadMessages]);

  // Auto-select first session if none chosen.
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Auto-scroll chat to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Refresh provider health when leaving the chat tab.
  const refreshAll = useCallback(() => {
    loadSessions();
    loadProviders();
    loadFailovers();
  }, [loadSessions, loadProviders, loadFailovers]);

  // --- Actions ---
  const newSession = async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Conversation" }),
    });
    const data = await res.json();
    await loadSessions();
    setActiveSessionId(data.session.id);
    setMessages([]);
    setLastResponse(null);
  };

  const deleteSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
    await loadSessions();
    toast({ title: "Conversation deleted" });
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");

    // Optimistic user message.
    const tempId = `temp-${Date.now()}`;
    const optimisticUser: ChatMessage = {
      id: tempId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);

    // Placeholder assistant message with loading state.
    const placeholderId = `placeholder-${Date.now()}`;
    setMessages((m) => [
      ...m,
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        provider: null,
      } as ChatMessage,
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: trimmed,
          model: selectedModel || undefined,
          primaryProviderId: primaryProviderId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Request failed");
      }

      const data: ChatResponse = await res.json();
      setLastResponse(data);

      // Replace placeholder with the real assistant message.
      setMessages((m) =>
        m
          .filter((msg) => msg.id !== tempId)
          .map((msg) =>
            msg.id === placeholderId
              ? {
                  id: data.message.id,
                  role: "assistant",
                  content: data.message.content,
                  model: data.model,
                  latencyMs: data.message.latencyMs,
                  tokensUsed: data.message.tokensUsed,
                  failedOver: data.message.failedOver,
                  createdAt: data.message.createdAt,
                  provider: data.provider,
                }
              : msg,
          ),
      );

      // Update session list (title may have changed, count changed).
      await loadSessions();
      // Refresh health & failover info.
      await Promise.all([loadProviders(), loadFailovers()]);

      // If a new session was created server-side, switch to it.
      if (!activeSessionId && data.sessionId) {
        setActiveSessionId(data.sessionId);
      }

      // Failover / fallback events are logged silently to the Failover Log
      // tab — we no longer show toast popups in the chat view. Users who
      // want to inspect routing decisions can open the "Failover Log" tab.
    } catch (err) {
      // Remove placeholder.
      setMessages((m) => m.filter((msg) => msg.id !== placeholderId && msg.id !== tempId));
      toast({
        title: "Request failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---------- Render ----------
  const activeProvider = providers.find((p) => p.id === primaryProviderId);
  const availableModels = activeProvider?.models ?? [];
  const totalAttempts = lastResponse?.attempts.length ?? 0;
  const healthyCount = providers.filter((p) => p.status === "healthy").length;
  const degradedCount = providers.filter((p) => p.status === "degraded").length;
  const downCount = providers.filter((p) => p.status === "down").length;

  // ── Auth gate ──
  // While checking the session, show a minimal loader. If no session, show
  // the AuthScreen (login/signup). Otherwise render the authenticated app.
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!authUser || !authOrg || !authRole) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-bold text-base md:text-lg leading-tight tracking-tight">
                Marq <span className="text-emerald-600 dark:text-emerald-400">AI</span>
              </div>
              <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 -mt-0.5">
                Unified AI Aggregator
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300">{healthyCount} healthy</span>
            </div>
            {degradedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-600 dark:text-slate-300">{degradedCount} degraded</span>
              </div>
            )}
            {downCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-600 dark:text-slate-300">{downCount} down</span>
              </div>
            )}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="bg-slate-100 dark:bg-slate-900">
              <TabsTrigger value="chat" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="compare" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <GitCompare className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Compare</span>
              </TabsTrigger>
              <TabsTrigger value="prompts" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <BookMarked className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Prompts</span>
              </TabsTrigger>
              <TabsTrigger value="agent" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Brain className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Agent</span>
              </TabsTrigger>
              <TabsTrigger value="providers" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Providers</span>
              </TabsTrigger>
              <TabsTrigger value="guide" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Guide</span>
              </TabsTrigger>
              <TabsTrigger value="health" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Health</span>
              </TabsTrigger>
              <TabsTrigger value="failovers" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Failover Log</span>
              </TabsTrigger>
              <TabsTrigger value="org" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">Team</span>
              </TabsTrigger>
              <TabsTrigger value="apikeys" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Key className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">API Keys</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Org switcher + user menu */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setOrgMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline max-w-32 truncate">{authOrg.name}</span>
                <Badge variant="outline" className="text-xs capitalize hidden lg:inline">{authRole}</Badge>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {orgMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50">
                    <div className="p-2 text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      Your organizations
                    </div>
                    {memberships.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSwitchOrg(m.org.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${m.org.id === authOrg.id ? "bg-slate-50 dark:bg-slate-800/50" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{m.org.name}</span>
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-xs">
                  {(authUser.name || authUser.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button size="sm" variant="ghost" onClick={handleLogout} title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col">
          {/* CHAT TAB */}
          <TabsContent value="chat" className="flex-1 m-0 data-[state=inactive]:hidden">
            <div className="flex h-[calc(100vh-4rem)]">
              {/* Sidebar: Sessions */}
              <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60">
                <div className="p-3">
                  <Button onClick={newSession} className="w-full" variant="default">
                    <Plus className="w-4 h-4 mr-2" />
                    New Conversation
                  </Button>
                </div>
                <Separator />
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {sessions.length === 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 p-4 text-center">
                        No conversations yet.
                      </div>
                    )}
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveSessionId(s.id);
                          setLastResponse(null);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-colors group ${
                          activeSessionId === s.id
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                            : "hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{s.title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {s.lastMessage || "No messages yet"}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(s.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                            aria-label="Delete conversation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(s.updatedAt).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </aside>

              {/* Chat Area */}
              <section className="flex-1 flex flex-col min-w-0">
                {/* Provider selection bar */}
                <div className="border-b border-slate-200 dark:border-slate-800 p-3 bg-white/60 dark:bg-slate-950/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 mr-1">
                      Primary:
                    </span>
                    {/* Auto (best available) — no primary pinned; server picks the healthiest provider */}
                    <button
                      onClick={() => {
                        setPrimaryProviderId(null);
                        setSelectedModel("");
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        primaryProviderId === null
                          ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-sm"
                          : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                      }`}
                      title="Marq picks the best available provider automatically and falls over if one is down."
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Auto
                      {primaryProviderId === null && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPrimaryProviderId(p.id);
                          setSelectedModel(p.models[0] ?? "");
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          primaryProviderId === p.id
                            ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm"
                            : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                        }`}
                        style={primaryProviderId === p.id ? { borderColor: p.color, color: p.color } : undefined}
                      >
                        <ProviderIcon icon={p.icon} color={p.color} size={14} />
                        {p.displayName}
                        {primaryProviderId === p.id && (
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: statusMeta[p.status].color }}
                          />
                        )}
                      </button>
                    ))}
                    <div className="flex-1" />
                    {availableModels.length > 0 && (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-xs bg-transparent border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500"
                      >
                        <option value="">Auto model</option>
                        {availableModels.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>
                      Failover chain:{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {primaryProviderId === null
                          ? "Auto (healthiest provider first)"
                          : providers
                              .slice()
                              .sort((a, b) => {
                                // pinned primary first, then by priority
                                if (a.id === primaryProviderId) return -1;
                                if (b.id === primaryProviderId) return 1;
                                return a.priority - b.priority;
                              })
                              .map((p) => p.displayName)
                              .join(" → ")}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                    {messages.length === 0 && !sending && (
                      <EmptyChatState providers={providers} onTry={(t) => setInput(t)} />
                    )}
                    {messages.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        sending={sending && m.id.startsWith("placeholder-")}
                        originalProviderId={
                          m.failedOver ? (m.originalProviderId ?? undefined) : undefined
                        }
                        providers={providers}
                      />
                    ))}
                  </div>
                </div>

                {/* Composer */}
                <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
                  <div className="max-w-3xl mx-auto">
                    {/* Failover / fallback events are no longer surfaced as
                        popups in the chat view — they're logged to the
                        "Failover Log" tab instead, keeping the chat clean. */}
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={`Send a message to ${activeProvider?.displayName ?? "Marq AI"}…  (Enter to send, Shift+Enter for newline)`}
                        rows={1}
                        className="resize-none min-h-[44px] max-h-40 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                        disabled={sending}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!input.trim() || sending}
                        size="icon"
                        className="h-[44px] w-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="mt-1.5 text-[10px] text-slate-400 text-center">
                      Marq AI automatically falls over to the next provider if the primary fails.
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </TabsContent>

          {/* AGENT TAB */}
          <TabsContent value="agent" className="flex-1 m-0 data-[state=inactive]:hidden">
            <AgentPanel providers={providers} />
          </TabsContent>

          {/* PROVIDERS TAB */}
          <TabsContent value="providers" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <ProvidersPanel
              providers={providers}
              onChanged={refreshAll}
              onMovePriority={(id, dir) => movePriority(id, dir, providers, setProviders, refreshAll)}
            />
          </TabsContent>

          {/* PROVIDER GUIDE TAB */}
          <TabsContent value="guide" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <ProviderGuidePanel
              onUsePrompt={(prompt) => { setInput(prompt); setTab("chat"); }}
            />
          </TabsContent>

          {/* HEALTH TAB */}
          <TabsContent value="health" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <HealthPanel providers={providers} failovers={failovers} onRefresh={refreshAll} />
          </TabsContent>

          {/* FAILOVER LOG TAB */}
          <TabsContent value="failovers" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <FailoverLogPanel failovers={failovers} onRefresh={loadFailovers} />
          </TabsContent>

          {/* COMPARE TAB */}
          <TabsContent value="compare" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <ComparePanel providers={providers} />
          </TabsContent>

          {/* PROMPTS TAB */}
          <TabsContent value="prompts" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <PromptsPanel onUse={(body) => { setInput(body); setTab("chat"); }} />
          </TabsContent>

          {/* ORG / TEAM TAB */}
          <TabsContent value="org" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <OrganizationPanel auth={{ user: authUser, org: authOrg, role: authRole }} />
          </TabsContent>

          {/* API KEYS TAB */}
          <TabsContent value="apikeys" className="flex-1 m-0 data-[state=inactive]:hidden overflow-y-auto">
            <ApiKeysPanel auth={{ role: authRole }} />
          </TabsContent>
        </Tabs>
      </main>

      <Toaster />
    </div>
  );
}

// ---------- Empty state ----------
function EmptyChatState({ providers, onTry }: { providers: Provider[]; onTry: (t: string) => void }) {
  const suggestions = [
    "Explain how Marq AI failover works",
    "Write a Python function that retries with backoff",
    "Compare GPT-4o vs Gemini vs Claude for coding",
    "What are the trade-offs of multi-provider routing?",
  ];
  return (
    <div className="text-center py-12">
      <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 items-center justify-center shadow-xl shadow-emerald-500/20 mb-5">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Welcome to Marq AI</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-sm">
        One unified gateway to{" "}
        {providers.map((p, i) => (
          <span key={p.id}>
            <span style={{ color: p.color }} className="font-medium">{p.displayName}</span>
            {i < providers.length - 2 ? ", " : i === providers.length - 2 ? " and " : ""}
          </span>
        ))}
        . Send a message to start — if your primary provider fails, Marq automatically falls over.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8 max-w-xl mx-auto text-left">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onTry(s)}
            className="text-left text-sm p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all"
          >
            <span className="text-slate-700 dark:text-slate-300">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Message Bubble ----------
function MessageBubble({
  message,
  sending,
  originalProviderId,
  providers,
}: {
  message: ChatMessage;
  sending: boolean;
  originalProviderId?: string;
  providers: Provider[];
}) {
  const isUser = message.role === "user";
  const isPlaceholder = sending;
  const provider = message.provider;
  const originalProvider = originalProviderId
    ? providers.find((p) => p.id === originalProviderId)
    : null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback
          className={isUser ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300" : ""}
          style={!isUser && provider ? { backgroundColor: `${provider.color}20`, color: provider.color } : undefined}
        >
          {isUser ? (
            "You"
          ) : provider ? (
            <ProviderIcon icon={provider.icon} color={provider.color} size={18} />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        <div className="flex items-center gap-2 mb-1 text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {isUser ? "You" : provider?.displayName ?? "Marq AI"}
          </span>
          {!isUser && message.model && (
            <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono">
              {message.model}
            </Badge>
          )}
          {!isUser && message.latencyMs != null && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {message.latencyMs}ms
            </span>
          )}
          {!isUser && message.tokensUsed != null && (
            <span className="text-[10px] text-slate-400">
              ~{message.tokensUsed} tok
            </span>
          )}
        </div>

        {/* Per-message failover badge removed — events are logged to the
            "Failover Log" tab instead of cluttering the chat. */}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-prose ${
            isUser
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          }`}
        >
          {isPlaceholder ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Routing through providers…</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Providers Panel ----------
function ProvidersPanel({
  providers,
  onChanged,
  onMovePriority,
}: {
  providers: Provider[];
  onChanged: () => void;
  onMovePriority: (id: string, dir: "up" | "down") => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [adding, setAdding] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);

  // Run a health check on mount so stale "down" errors from before a code
  // fix are replaced with the current provider status.
  const runHealthCheck = useCallback(async (silent = false) => {
    setHealthChecking(true);
    try {
      const res = await fetch("/api/providers/health-check", { method: "POST" });
      const data = await res.json();
      if (!silent) {
        toast({
          title: "Health check complete",
          description: `${data.healthy ?? 0} healthy, ${data.down ?? 0} down`,
        });
      }
      onChanged();
    } catch {
      if (!silent) toast({ title: "Health check failed", variant: "destructive" });
    } finally {
      setHealthChecking(false);
    }
  }, [onChanged, toast]);

  useEffect(() => {
    runHealthCheck(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (p: Provider) => {
    await fetch(`/api/providers/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    onChanged();
    toast({
      title: `${p.displayName} ${p.active ? "disabled" : "enabled"}`,
    });
  };

  const saveApiKey = async (id: string, apiKey: string) => {
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    onChanged();
    toast({ title: "API key saved" });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Provider Configuration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure the AI providers Marq routes through. Lower priority = tried first in the failover chain.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runHealthCheck(false)}
            variant="outline"
            size="sm"
            disabled={healthChecking}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${healthChecking ? "animate-spin" : ""}`} />
            {healthChecking ? "Checking…" : "Refresh Health"}
          </Button>
          <Button onClick={() => setAdding(true)} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {providers.map((p, idx) => (
          <ProviderCard
            key={p.id}
            provider={p}
            index={idx}
            total={providers.length}
            onToggle={() => toggleActive(p)}
            onEdit={() => setEditing(p)}
            onMoveUp={idx > 0 ? () => onMovePriority(p.id, "up") : undefined}
            onMoveDown={idx < providers.length - 1 ? () => onMovePriority(p.id, "down") : undefined}
          />
        ))}
      </div>

      {(editing || adding) && (
        <ProviderEditDialog
          provider={editing}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={() => {
            setEditing(null);
            setAdding(false);
            onChanged();
          }}
          onSaveKey={saveApiKey}
        />
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  index,
  total,
  onToggle,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  provider: Provider;
  index: number;
  total: number;
  onToggle: () => void;
  onEdit: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const Status = statusMeta[provider.status].icon;
  return (
    <Card className={`overflow-hidden ${!provider.active ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${provider.color}15` }}
          >
            <ProviderIcon icon={provider.icon} color={provider.color} size={22} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{provider.displayName}</span>
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                #{index + 1} priority
              </Badge>
              {provider.hasApiKey ? (
                <Badge className="text-[10px] py-0 h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-100">
                  <Key className="w-2.5 h-2.5 mr-1" /> Key set
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                  Demo mode
                </Badge>
              )}
              <Badge
                className="text-[10px] py-0 h-4"
                style={{
                  backgroundColor: `${statusMeta[provider.status].color}20`,
                  color: statusMeta[provider.status].color,
                }}
              >
                <Status className="w-2.5 h-2.5 mr-1" />
                {statusMeta[provider.status].label}
              </Badge>
            </div>
            {provider.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2">
                {provider.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {provider.models.map((m) => (
                <span
                  key={m}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  {m}
                </span>
              ))}
            </div>
            {provider.lastError && (
              <p className="text-[10px] text-red-500 mt-1.5 truncate">
                Last error: {provider.lastError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {onMoveUp && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp}>
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
              )}
              {onMoveDown && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown}>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 text-xs">
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 px-1">
              <Switch checked={provider.active} onCheckedChange={onToggle} className="scale-75" />
              <span>{provider.active ? "On" : "Off"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderEditDialog({
  provider,
  onClose,
  onSaved,
  onSaveKey,
}: {
  provider: Provider | null;
  onClose: () => void;
  onSaved: () => void;
  onSaveKey: (id: string, key: string) => void;
}) {
  const isCreating = !provider;
  const [form, setForm] = useState({
    name: provider?.name ?? "",
    displayName: provider?.displayName ?? "",
    description: provider?.description ?? "",
    apiEndpoint: provider?.apiEndpoint ?? "",
    apiKey: "",
    models: provider?.models.join(", ") ?? "",
    color: provider?.color ?? "#10a37f",
    icon: provider?.icon ?? "bot",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        displayName: form.displayName,
        description: form.description || null,
        apiEndpoint: form.apiEndpoint || null,
        apiKey: form.apiKey || null,
        models: form.models.split(",").map((s) => s.trim()).filter(Boolean),
        color: form.color,
        icon: form.icon,
      };

      if (isCreating) {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create provider");
        }
        toast({ title: "Provider created" });
      } else {
        const updates: Record<string, unknown> = {
          displayName: body.displayName,
          description: body.description,
          apiEndpoint: body.apiEndpoint,
          color: body.color,
          icon: body.icon,
          models: body.models,
        };
        if (body.apiKey) updates.apiKey = body.apiKey;

        const res = await fetch(`/api/providers/${provider!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to save");
        toast({ title: "Provider updated" });
      }
      onSaved();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreating ? "Add Provider" : `Edit ${provider?.displayName}`}</DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Configure a new AI provider for Marq's failover chain."
              : "Update provider settings, API key, and supported models."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!isCreating && (
            <div className="text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
              Provider name (internal ID): <code className="font-mono">{provider?.name}</code>
            </div>
          )}
          {isCreating && (
            <div>
              <Label htmlFor="name" className="text-xs">Internal Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="openai, gemini, claude, mistral…"
                className="mt-1"
              />
            </div>
          )}
          <div>
            <Label htmlFor="displayName" className="text-xs">Display Name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="desc" className="text-xs">Description</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="endpoint" className="text-xs">API Endpoint</Label>
            <Input
              id="endpoint"
              value={form.apiEndpoint}
              onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="apikey" className="text-xs">
              API Key {provider && (provider.hasApiKey ? "(leave blank to keep current)" : "(optional — demo mode without key)")}
            </Label>
            <Input
              id="apikey"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-…"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="models" className="text-xs">Models (comma-separated)</Label>
            <Input
              id="models"
              value={form.models}
              onChange={(e) => setForm({ ...form, models: e.target.value })}
              placeholder="gpt-4o, gpt-4-turbo, o1-mini"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="color" className="text-xs">Brand Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-9 rounded border border-slate-200 dark:border-slate-800 cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="icon" className="text-xs">Icon Type</Label>
              <select
                id="icon"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-md bg-transparent"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="claude">Claude</option>
                <option value="bot">Generic Bot</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isCreating ? "Create Provider" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Health Panel ----------
function HealthPanel({
  providers,
  failovers,
  onRefresh,
}: {
  providers: Provider[];
  failovers: FailoverLog[];
  onRefresh: () => void;
}) {
  const totalRequests = providers.length > 0 ? providers.length : 0;
  const healthyCount = providers.filter((p) => p.status === "healthy").length;
  const degradedCount = providers.filter((p) => p.status === "degraded").length;
  const downCount = providers.filter((p) => p.status === "down").length;
  const uptimePct = totalRequests > 0 ? Math.round((healthyCount / totalRequests) * 100) : 100;

  // Recent failover counts (last 24h).
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentFailovers = failovers.filter((f) => new Date(f.createdAt).getTime() > cutoff);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live status across every provider in the Marq aggregator.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Aggregated Uptime"
          value={`${uptimePct}%`}
          icon={Shield}
          color="#10b981"
        />
        <KpiCard
          label="Active Providers"
          value={`${providers.filter((p) => p.active).length} / ${providers.length}`}
          icon={Server}
          color="#3b82f6"
        />
        <KpiCard
          label="Failovers (24h)"
          value={recentFailovers.length}
          icon={Zap}
          color="#f59e0b"
        />
        <KpiCard
          label="Avg Latency"
          value={
            providers.some((p) => p.lastLatencyMs != null)
              ? `${Math.round(
                  providers.filter((p) => p.lastLatencyMs != null).reduce((s, p) => s + (p.lastLatencyMs ?? 0), 0) /
                    providers.filter((p) => p.lastLatencyMs != null).length,
                )}ms`
              : "—"
          }
          icon={Clock}
          color="#8b5cf6"
        />
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((p) => {
          const Status = statusMeta[p.status].icon;
          return (
            <Card key={p.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${p.color}15` }}
                    >
                      <ProviderIcon icon={p.icon} color={p.color} size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{p.displayName}</CardTitle>
                      <CardDescription className="text-xs">
                        Priority #{p.priority + 1}
                      </CardDescription>
                    </div>
                  </div>
                  <Status
                    className="w-5 h-5"
                    style={{ color: statusMeta[p.status].color }}
                  />
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className="font-medium" style={{ color: statusMeta[p.status].color }}>
                    {statusMeta[p.status].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Last latency</span>
                  <span className="font-mono">{p.lastLatencyMs != null ? `${p.lastLatencyMs}ms` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Last checked</span>
                  <span>{p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">API key</span>
                  <span>{p.hasApiKey ? "Configured" : "Demo mode"}</span>
                </div>
                {p.lastError && (
                  <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-[10px] break-all">
                    {p.lastError}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof Server;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

// ---------- Failover Log Panel ----------
function FailoverLogPanel({
  failovers,
  onRefresh,
}: {
  failovers: FailoverLog[];
  onRefresh: () => void;
}) {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Failover Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Every time Marq rerouted a request from a failing provider to a healthy one.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {failovers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
            <h3 className="font-semibold">No failovers yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Every request has been served by its primary provider. Send a few messages to see failover events here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {failovers.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${f.fromProvider.color}15` }}
                    >
                      <XCircle className="w-4 h-4" style={{ color: f.fromProvider.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.fromProvider.displayName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">failed</div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${f.toProvider.color}15` }}
                    >
                      <CheckCircle2 className="w-4 h-4" style={{ color: f.toProvider.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.toProvider.displayName}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">took over</div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      {reasonLabel[f.reason] ?? f.reason}
                    </Badge>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(f.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                {f.errorMessage && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-900 text-[10px] text-slate-500 dark:text-slate-400 font-mono break-all">
                    {f.errorMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Priority reorder helper ----------
async function movePriority(
  id: string,
  dir: "up" | "down",
  providers: Provider[],
  setProviders: (p: Provider[]) => void,
  refresh: () => void,
) {
  const sorted = [...providers].sort((a, b) => a.priority - b.priority);
  const idx = sorted.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return;

  const a = sorted[idx];
  const b = sorted[swapWith];
  // Swap priorities.
  await Promise.all([
    fetch(`/api/providers/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: b.priority }),
    }),
    fetch(`/api/providers/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: a.priority }),
    }),
  ]);
  refresh();
}
