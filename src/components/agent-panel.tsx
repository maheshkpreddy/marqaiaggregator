"use client";

/**
 * Marq AI Aggregator — AgentPanel (chat-style)
 *
 * A ZAI / Claude-style conversational agent UI. The user picks an agent
 * persona (template), then chats with that agent in a multi-turn
 * conversation. Each user turn runs the ReAct loop (with tool calls +
 * failover) and the agent's final answer is appended to the chat. The
 * user can keep prompting until they're satisfied — full conversation
 * continuity is preserved across turns (the agent sees all prior user +
 * assistant messages).
 *
 * Layout:
 *   ┌─ Sidebar (left, 280px) ─┐  ┌─ Chat area (right, flex) ──────────┐
 *   │ + New chat              │  │ Persona header + picker toggle      │
 *   │                         │  │ ──────────────────────────────────  │
 *   │ Conversation list       │  │                                     │
 *   │  • "What's the AI news" │  │ Chat messages (user + assistant     │
 *   │  • "Calculate MRR for…" │  │ bubbles, with expandable step       │
 *   │  • …                    │  │ trace under each assistant reply)   │
 *   │                         │  │                                     │
 *   └─────────────────────────┘  │ ──────────────────────────────────  │
 *                                │ [Input box]              [Send]     │
 *                                └─────────────────────────────────────┘
 *
 * Backend: POST /api/agent/chat runs one ReAct turn; GET /api/agent/sessions
 * lists prior conversations; GET /api/agent/sessions/[id] loads one with
 * all its messages; the agent's ReAct step trace is JSON-attached to each
 * assistant Message row.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain,
  Sparkles,
  Loader2,
  Send,
  Plus,
  Trash2,
  Search as SearchIcon,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  MessageSquare,
  Wrench,
  Code2,
  FlaskConical,
  ClipboardList,
  TrendingUp,
  Server,
  Timer,
  FileText,
  Shield,
  Bot,
  Compass,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────
interface Provider {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
}

type AgentTemplateCategory =
  | "engineering" | "business" | "operations" | "general"
  | "agent_arch" | "marq_products" | "sales" | "consulting"
  | "security" | "marketing" | "strategy" | "sports";

interface AgentTemplate {
  key: string;
  displayName: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  category: AgentTemplateCategory;
  defaultMaxSteps: number;
  tools: Array<{ name: string; description: string; signature: string }>;
  suggestedGoals: string[];
}

interface AgentStepRecord {
  stepNumber: number;
  thought: string | null;
  action: string | null;
  actionInput: unknown;
  observation: string | null;
  errorMessage?: string | null;
  providerName?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  tokensUsed?: number | null;
  failedOver?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  latencyMs?: number | null;
  tokensUsed?: number | null;
  failedOver?: boolean;
  createdAt: string;
  provider?: { id: string; name: string; displayName: string; color: string; icon: string } | null;
  agentSteps?: AgentStepRecord[] | null;
}

interface ChatSession {
  id: string;
  title: string;
  agentType: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string | null;
}

// ─── Icon helpers ───────────────────────────────────────────────────────
const templateLucideMap: Record<string, typeof Sparkles> = {
  Sparkles, Code2, FlaskConical, Server, ClipboardList, TrendingUp, Compass, Search, Brain,
};

function TemplateIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = templateLucideMap[name];
  if (Icon) return <Icon className={className} style={style} />;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, ...style }} role="img" aria-hidden>
      {name}
    </span>
  );
}

const toolIcons: Record<string, typeof Sparkles> = {
  web_search: SearchIcon,
  calculator: TrendingUp,
  current_time: Timer,
  text_summary: FileText,
  generate_code: Code2,
  run_tests: FlaskConical,
  parse_requirements: ClipboardList,
  calculate_revenue: TrendingUp,
  get_deploy_status: Server,
  create_ticket: FileText,
  write_runbook: Shield,
  final_answer: CheckCircle2,
};

function ProviderIcon({ icon, color, size = 16 }: { icon: string; color: string; size?: number }) {
  switch (icon) {
    case "openai":
      return <span style={{ color, fontSize: size, fontWeight: 700 }}>●</span>;
    case "claude":
    case "anthropic":
      return <span style={{ color, fontSize: size, fontWeight: 700 }}>✦</span>;
    case "gemini":
    case "google":
      return <span style={{ color, fontSize: size, fontWeight: 700 }}>◆</span>;
    default:
      return <Bot className="w-4 h-4" style={{ color }} />;
  }
}

// ─── Category metadata ──────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  agent_arch: "AI Agent Architecture",
  engineering: "Engineering & DevOps",
  marq_products: "Marq AI Products",
  sales: "Sales & Revenue",
  consulting: "Consulting",
  business: "Business",
  security: "Security & Compliance",
  marketing: "Marketing & Content",
  strategy: "Strategy & Finance",
  operations: "Operations & People",
  sports: "Sports & Entertainment",
};
const CATEGORY_ORDER: string[] = [
  "general", "agent_arch", "engineering", "marq_products", "sales",
  "consulting", "business", "security", "marketing", "strategy",
  "operations", "sports",
];

// ─── Main component ─────────────────────────────────────────────────────
export function AgentPanel({ providers }: { providers: Provider[] }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("general");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [tplSearch, setTplSearch] = useState("");
  const [tplCategoryFilter, setTplCategoryFilter] = useState<string | "all">("all");

  const selectedTemplate = templates.find((t) => t.key === selectedTemplateKey) ?? templates[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load templates list once.
  useEffect(() => {
    fetch("/api/agent/templates")
      .then((r) => r.json())
      .then((d) => {
        const list: AgentTemplate[] = d.templates ?? [];
        setTemplates(list);
        if (list.length > 0 && !list.find((t) => t.key === selectedTemplateKey)) {
          setSelectedTemplateKey(list[0].key);
        }
      })
      .catch(() => {});
  }, []);

  // Load sessions list.
  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/agent/sessions");
    const data = await res.json();
    setSessions(data.sessions ?? []);
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load one session's messages.
  const loadSession = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/agent/sessions/${id}`);
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setMessages(data.messages ?? []);
      setActiveSessionId(id);
      // Sync the persona picker to the session's agentType.
      if (data.session?.agentType) {
        setSelectedTemplateKey(data.session.agentType);
      }
    } catch {
      toast({ title: "Failed to load conversation", variant: "destructive" });
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Start a new conversation.
  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowPersonaPicker(true);
  };

  // Send a message.
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !selectedTemplate) return;

    // Optimistic: add the user message immediately.
    const optimisticUser: ChatMessage = {
      id: `tmp-user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const optimisticAssistant: ChatMessage = {
      id: `tmp-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      provider: null,
    };
    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          agentType: selectedTemplateKey,
          sessionId: activeSessionId,
          maxSteps: 6,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Failed to send message");
      }
      const data = await res.json();

      // Replace the optimistic assistant placeholder with the real response.
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimisticAssistant.id);
        const realAssistant: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: data.content,
          model: data.finalModel,
          latencyMs: data.totalLatencyMs,
          tokensUsed: data.totalTokensUsed,
          failedOver: (data.failedOverCount ?? 0) > 0,
          createdAt: new Date().toISOString(),
          provider: data.finalProviderName
            ? {
                id: data.finalProviderId ?? "",
                name: data.finalProviderName.toLowerCase().replace(/\s+/g, "_"),
                displayName: data.finalProviderName,
                color: providers.find((p) => p.displayName === data.finalProviderName)?.color ?? "#64748b",
                icon: providers.find((p) => p.displayName === data.finalProviderName)?.icon ?? "bot",
              }
            : null,
          agentSteps: data.steps ?? [],
        };
        return [...without, realAssistant];
      });

      // If this was the first turn, a new session was created — remember its id.
      if (!activeSessionId && data.sessionId) {
        setActiveSessionId(data.sessionId);
      }
      // Refresh the sessions sidebar (title/preview may have changed).
      loadSessions();

      if (!data.ok) {
        toast({
          title: "Agent couldn't finish",
          description: data.errorMessage ?? "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err) {
      // Replace the optimistic assistant placeholder with an error.
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimisticAssistant.id);
        return [
          ...without,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${err instanceof Error ? err.message : String(err)}`,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Delete a session.
  const deleteSession = async (id: string) => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    await fetch(`/api/agent/sessions/${id}`, { method: "DELETE" });
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
    await loadSessions();
    toast({ title: "Conversation deleted" });
  };

  // Filter templates for the picker.
  const searchQ = tplSearch.trim().toLowerCase();
  const visibleTemplates = templates.filter((t) => {
    if (tplCategoryFilter !== "all" && t.category !== tplCategoryFilter) return false;
    if (!searchQ) return true;
    return (
      t.displayName.toLowerCase().includes(searchQ) ||
      t.tagline.toLowerCase().includes(searchQ) ||
      t.description.toLowerCase().includes(searchQ) ||
      t.key.toLowerCase().includes(searchQ)
    );
  });
  const templatesByCategory: Record<string, AgentTemplate[]> = {};
  for (const t of visibleTemplates) {
    if (!templatesByCategory[t.category]) templatesByCategory[t.category] = [];
    templatesByCategory[t.category].push(t);
  }
  const categoryCounts: Record<string, number> = {};
  for (const t of templates) categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[520px] gap-3">
      {/* ─── Sidebar: conversations ─── */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-2">
        <Button
          onClick={startNewChat}
          variant="default"
          size="sm"
          className="w-full justify-start"
        >
          <Plus className="w-4 h-4 mr-2" />
          New agent chat
        </Button>

        <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          {loadingSessions ? (
            <div className="p-4 text-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No conversations yet.
              <br />
              Start a new chat to begin.
            </div>
          ) : (
            <div className="p-1.5 space-y-1">
              {sessions.map((s) => {
                const tpl = templates.find((t) => t.key === s.agentType);
                const isActive = s.id === activeSessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors group ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      {tpl && (
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs"
                          style={{ backgroundColor: `${tpl.color}15`, color: tpl.color }}
                        >
                          <TemplateIcon name={tpl.icon} className="w-3 h-3" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{s.title}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {s.lastMessagePreview ?? "No messages yet"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main chat area ─── */}
      <div className="flex-1 flex flex-col min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
        {/* Persona header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          {selectedTemplate ? (
            <>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                style={{ backgroundColor: `${selectedTemplate.color}15`, color: selectedTemplate.color }}
              >
                <TemplateIcon name={selectedTemplate.icon} className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: selectedTemplate.color }}>
                  {selectedTemplate.displayName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {selectedTemplate.tagline}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPersonaPicker((v) => !v)}
                disabled={sending}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Switch agent
              </Button>
            </>
          ) : (
            <div className="text-sm text-slate-500">Loading agents…</div>
          )}
        </div>

        {/* Persona picker (collapsible) */}
        {showPersonaPicker && selectedTemplate && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 max-h-[360px] overflow-y-auto">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
              <div className="relative flex-1">
                <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                  placeholder={`Search ${templates.length} agents…`}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                {visibleTemplates.length} of {templates.length}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setTplCategoryFilter("all")}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                  tplCategoryFilter === "all"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                All ({templates.length})
              </button>
              {CATEGORY_ORDER.filter((c) => categoryCounts[c]).map((c) => {
                const active = tplCategoryFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setTplCategoryFilter(active ? "all" : c)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      active
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {CATEGORY_LABELS[c]} ({categoryCounts[c]})
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              {CATEGORY_ORDER.filter((cat) => templatesByCategory[cat]?.length).length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-6">No agents match your search.</div>
              ) : (
                CATEGORY_ORDER
                  .filter((cat) => templatesByCategory[cat]?.length)
                  .map((cat) => (
                    <div key={cat}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                        {CATEGORY_LABELS[cat]} · {templatesByCategory[cat].length}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {templatesByCategory[cat].map((t) => {
                          const isSelected = t.key === selectedTemplateKey;
                          return (
                            <button
                              key={t.key}
                              onClick={() => {
                                setSelectedTemplateKey(t.key);
                                setShowPersonaPicker(false);
                                setTplSearch("");
                                setTplCategoryFilter("all");
                              }}
                              className={`text-left p-2 rounded-md border transition-all ${
                                isSelected
                                  ? "bg-white dark:bg-slate-900 shadow-sm"
                                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/50 dark:bg-slate-900/50"
                              }`}
                              style={isSelected ? { borderColor: t.color, boxShadow: `0 0 0 1px ${t.color}` } : undefined}
                            >
                              <div className="flex items-start gap-1.5">
                                <div
                                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-sm"
                                  style={{ backgroundColor: `${t.color}15`, color: t.color }}
                                >
                                  <TemplateIcon name={t.icon} className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-semibold truncate" style={isSelected ? { color: t.color } : undefined}>
                                      {t.displayName}
                                    </span>
                                    {isSelected && <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: t.color }} />}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {t.tagline}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loadingMessages ? (
            <EmptyAgentState template={selectedTemplate} onPickGoal={(g) => setInput(g)} />
          ) : loadingMessages ? (
            <div className="text-center text-xs text-slate-500 py-10">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading conversation…
            </div>
          ) : (
            messages.map((m, idx) => (
              <AgentMessageBubble
                key={m.id}
                message={m}
                isLast={idx === messages.length - 1}
                sending={sending && idx === messages.length - 1 && m.role === "assistant" && !m.content}
                templateColor={selectedTemplate?.color ?? "#10b981"}
                templateIcon={selectedTemplate?.icon ?? "Sparkles"}
                templateDisplayName={selectedTemplate?.displayName ?? "Agent"}
                providers={providers}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`Message ${selectedTemplate?.displayName ?? "agent"}…  (Enter to send, Shift+Enter for newline)`}
              rows={1}
              disabled={sending || !selectedTemplate}
              className="resize-none min-h-[44px] max-h-[160px] flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || sending || !selectedTemplate}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 text-center">
            Agent runs up to 6 ReAct steps per turn • Multi-provider failover • Conversation history preserved
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────
function EmptyAgentState({
  template,
  onPickGoal,
}: {
  template: AgentTemplate | undefined;
  onPickGoal: (g: string) => void;
}) {
  if (!template) {
    return (
      <div className="text-center text-xs text-slate-500 py-16">
        <Brain className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        Loading agents…
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="text-center mb-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl"
          style={{ backgroundColor: `${template.color}15`, color: template.color }}
        >
          <TemplateIcon name={template.icon} className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: template.color }}>
          {template.displayName}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          {template.description}
        </p>
      </div>
      {template.suggestedGoals.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2 text-center">
            Try one of these
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {template.suggestedGoals.slice(0, 4).map((g, i) => (
              <button
                key={i}
                onClick={() => onPickGoal(g)}
                className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-xs leading-relaxed"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ─────────────────────────────────────────────────────
function AgentMessageBubble({
  message,
  sending,
  templateColor,
  templateIcon,
  templateDisplayName,
  providers,
}: {
  message: ChatMessage;
  isLast: boolean;
  sending: boolean;
  templateColor: string;
  templateIcon: string;
  templateDisplayName: string;
  providers: Provider[];
}) {
  const isUser = message.role === "user";
  const [showSteps, setShowSteps] = useState(false);

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
            You
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-end max-w-prose">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">You</div>
          <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-emerald-600 text-white whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message.
  const hasSteps = (message.agentSteps?.length ?? 0) > 0;
  return (
    <div className="flex gap-3">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback style={{ backgroundColor: `${templateColor}20`, color: templateColor }}>
          <TemplateIcon name={templateIcon} className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 text-xs">
          <span className="font-medium" style={{ color: templateColor }}>
            {templateDisplayName}
          </span>
          {message.provider && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              via <ProviderIcon icon={message.provider.icon} color={message.provider.color} size={10} /> {message.provider.displayName}
            </span>
          )}
          {message.model && (
            <Badge variant="outline" className="text-[10px] py-0 h-4 font-mono">
              {message.model}
            </Badge>
          )}
          {message.latencyMs != null && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {(message.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          {message.failedOver && (
            <Badge className="text-[10px] py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              failed over
            </Badge>
          )}
        </div>
        <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-prose bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
          {sending ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Agent is reasoning…</span>
            </div>
          ) : (
            message.content
          )}
        </div>

        {/* Show steps expander */}
        {hasSteps && !sending && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowSteps((v) => !v)}
              className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
            >
              {showSteps ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showSteps ? "Hide" : "Show"} {message.agentSteps!.length} ReAct step{(message.agentSteps!.length ?? 0) !== 1 ? "s" : ""}
            </button>
            {showSteps && (
              <div className="mt-2 space-y-1.5">
                {message.agentSteps!.map((step, i) => (
                  <AgentStepRow key={i} step={step} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ReAct step row (compact, for the expander) ─────────────────────────
function AgentStepRow({ step }: { step: AgentStepRecord }) {
  const isFinal = step.action === "final_answer";
  const isError = Boolean(step.errorMessage);
  const ToolIcon = isFinal
    ? CheckCircle2
    : isError
      ? XCircle
      : toolIcons[step.action ?? ""] ?? Wrench;
  const iconColor = isFinal ? "#10b981" : isError ? "#ef4444" : "#3b82f6";

  let prettyInput: string | null = null;
  if (step.actionInput != null) {
    try {
      prettyInput = typeof step.actionInput === "string"
        ? step.actionInput
        : JSON.stringify(step.actionInput);
    } catch {
      prettyInput = String(step.actionInput);
    }
  }

  return (
    <div className="relative pl-6 py-1.5 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
      <div
        className="absolute -left-[7px] top-2 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950"
        style={{ backgroundColor: iconColor }}
      />
      <div className="flex items-center gap-1.5 mb-0.5">
        <ToolIcon className="w-3 h-3 flex-shrink-0" style={{ color: iconColor }} />
        <span className="text-[10px] font-mono text-slate-400">#{step.stepNumber}</span>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
          {isFinal ? "Final answer" : isError ? "Parse error" : step.action ?? "unknown"}
        </span>
        {step.providerName && (
          <span className="text-[10px] text-slate-400 ml-auto">via {step.providerName}</span>
        )}
      </div>
      {step.thought && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mb-0.5">
          {step.thought}
        </div>
      )}
      {prettyInput && (
        <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded mt-1 break-all">
          {prettyInput}
        </div>
      )}
      {step.observation && (
        <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap break-words">
          → {step.observation.slice(0, 500)}{step.observation.length > 500 ? "…" : ""}
        </div>
      )}
      {step.errorMessage && (
        <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          {step.errorMessage}
        </div>
      )}
    </div>
  );
}
