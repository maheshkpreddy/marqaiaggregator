"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Sparkles,
  Settings2,
  Trash2,
  Square,
  Bot,
  User,
  Zap,
  Clock,
  Cpu,
  CornerDownLeft,
  XCircle,
} from "lucide-react";

/**
 * GeminiChatPanel — embedded inside the Marq AI aggregator as a tab.
 *
 * Why this lives inside the aggregator:
 *  - Inherits the aggregator's auth gate (only logged-in users can access)
 *  - Shares the same layout, theme, toast system, and UI primitives
 *  - No separate route / no separate auth flow
 *
 * The panel calls /api/gemini/* endpoints, which read GEMINI_API_KEY
 * server-side. The key is never exposed to the browser.
 */

interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  contextWindow: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  streaming?: boolean;
  error?: boolean;
  latencyMs?: number;
}

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are a helpful, concise assistant. Respond in well-structured Markdown when helpful.";

function formatLatency(ms?: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function GeminiChatPanel() {
  const { toast } = useToast();
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-latest");
  const [systemInstruction, setSystemInstruction] = useState<string>(DEFAULT_SYSTEM_INSTRUCTION);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch model list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gemini/models");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
          setSelectedModel(data.default ?? data.models[0].name);
        }
      } catch {
        // silent fail — hardcoded default is used
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const selectedModelMeta = useMemo(
    () => models.find((m) => m.name === selectedModel),
    [models, selectedModel]
  );

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  }, []);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;

      setError(null);
      setInput("");

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
      };
      const assistantMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: "model",
        content: "",
        streaming: true,
      };

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const startTs = performance.now();

      try {
        const res = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            messages: history,
            systemInstruction,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errText = `HTTP ${res.status}`;
          try {
            const errJson = await res.json();
            if (errJson?.error) errText = errJson.error;
          } catch {}
          throw new Error(errText);
        }
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let sawErrorSentinel = false;
        let errMsg = "";
        let failoverNotice: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });

          // Detect failover info sentinel (server fell back to alternate model).
          const infoSentinel = "[STREAM_INFO]";
          const infoIdx = acc.indexOf(infoSentinel);
          if (infoIdx >= 0) {
            const afterInfo = acc.slice(infoIdx + infoSentinel.length);
            const endMatch = afterInfo.indexOf("\n\n");
            const infoText =
              endMatch >= 0
                ? afterInfo.slice(0, endMatch).trim()
                : afterInfo.trim();
            failoverNotice = infoText;
            const stripEnd =
              endMatch >= 0
                ? infoIdx + infoSentinel.length + endMatch + 2
                : acc.length;
            acc = acc.slice(0, infoIdx) + acc.slice(stripEnd);
            if (failoverNotice) {
              toast({
                title: "Switched model",
                description: failoverNotice,
              });
            }
          }

          const sentinel = "[STREAM_ERROR]";
          const idx = acc.lastIndexOf(sentinel);
          if (idx >= 0) {
            errMsg = acc.slice(idx + sentinel.length).trim();
            acc = acc.slice(0, idx);
            sawErrorSentinel = true;
            if (errMsg) setError(errMsg);
            break;
          }

          // Live-update the visible text. Trim leading whitespace so the
          // heartbeat byte doesn't show up as a stray space at the start.
          const visibleAcc = acc.replace(/^\s+/, "");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: visibleAcc } : m
            )
          );
        }

        const latencyMs = Math.round(performance.now() - startTs);
        const trimmedAcc = acc.trim();

        // If stream ended with no content AND no error sentinel, treat as a
        // server-side issue (e.g. Vercel function restart, network drop).
        if (!sawErrorSentinel && trimmedAcc.length === 0) {
          errMsg =
            "The server closed the connection without sending a response. This is usually a transient Vercel function issue — please try again in a few seconds.";
          setError(errMsg);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content:
                    trimmedAcc.length > 0
                      ? acc.replace(/^\s+/, "")
                      : `**Request failed.**\n\n\`${errMsg || "Unknown error"}\``,
                  streaming: false,
                  error: sawErrorSentinel || trimmedAcc.length === 0,
                  latencyMs,
                }
              : m
          )
        );

        if (sawErrorSentinel || trimmedAcc.length === 0) {
          toast({
            title: "Generation interrupted",
            description: errMsg || "The model returned an error mid-stream.",
            variant: "destructive",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (err instanceof DOMException && err.name === "AbortError") {
          // user cancelled — leave partial text
        } else {
          setError(message);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: `**Error:** ${message}`,
                    streaming: false,
                    error: true,
                  }
                : m
            )
          );
          toast({
            title: "Gemini request failed",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [input, isStreaming, messages, selectedModel, systemInstruction, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    stopStreaming();
    setMessages([]);
    setError(null);
    toast({
      title: "Conversation cleared",
      description: "Started a fresh Gemini chat.",
    });
  };

  const examplePrompts = [
    "Explain transformers like I'm a senior engineer who's never read the paper.",
    "Write a Python decorator that retries a function with exponential backoff.",
    "Compare Postgres and MongoDB for a SaaS with 10k tenants.",
    "Give me 5 counterintuitive productivity tips backed by research.",
  ];

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-sm shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight truncate">
                Gemini Chat
              </h2>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Direct streaming access to Google Gemini · server-side key
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedModelMeta && (
              <Badge variant="secondary" className="hidden md:inline-flex gap-1">
                <Cpu className="h-3 w-3" />
                {selectedModelMeta.displayName}
              </Badge>
            )}
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 w-[160px] sm:w-[190px] text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.length === 0 ? (
                  <SelectItem value={selectedModel} disabled>
                    Loading…
                  </SelectItem>
                ) : (
                  models.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{m.displayName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.contextWindow.toLocaleString()} ctx
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1.5">Settings</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Gemini chat settings</DialogTitle>
                  <DialogDescription>
                    Configure the system instruction that shapes Gemini&apos;s
                    behavior. Saved for this session only.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="system-instruction">System instruction</Label>
                    <Textarea
                      id="system-instruction"
                      value={systemInstruction}
                      onChange={(e) => setSystemInstruction(e.target.value)}
                      placeholder="e.g. You are a senior code reviewer. Be direct, cite line numbers."
                      rows={6}
                      className="resize-y font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Gemini calls this &quot;system_instruction&quot;. It is
                      prepended to every request and does not count as a turn.
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>About this integration</Label>
                    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium text-foreground">Region:</span>{" "}
                        Vercel <code className="font-mono">iad1</code> (US East) —
                        supported by Gemini API.
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Key:</span>{" "}
                        Read server-side from{" "}
                        <code className="font-mono">GEMINI_API_KEY</code> env var.
                        Never exposed to the browser.
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Access:</span>{" "}
                        Inherits the aggregator&apos;s auth — only logged-in users
                        can reach this tab.
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION)}
                  >
                    Reset
                  </Button>
                  <Button onClick={() => setSettingsOpen(false)}>Save & close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={clearConversation}
              disabled={isEmpty && !isStreaming}
              title="Clear conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Clear conversation</span>
            </Button>
          </div>
        </div>

        {/* Status row */}
        <div className="px-4 sm:px-6 pb-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Server-side key active
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="inline-flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {isStreaming ? "Streaming response…" : "Ready"}
          </span>
          {error && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <XCircle className="h-3 w-3" />
                {error.length > 80 ? error.slice(0, 80) + "…" : error}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chat body */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            <Card className="w-full max-w-2xl border-0 shadow-none sm:border sm:shadow-sm">
              <CardHeader className="text-center space-y-2 pb-2">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-md">
                  <Sparkles className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl">What can I help with?</CardTitle>
                <CardDescription>
                  Streaming chat with Google Gemini. Your API key stays
                  server-side — calls run from{" "}
                  <code className="font-mono text-xs">iad1</code> (US East).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-2">
                  {examplePrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(p)}
                      className="group text-left rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:border-accent"
                    >
                      <div className="flex items-start gap-2">
                        <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                        <span>{p}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 space-y-6"
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="border-t bg-background px-4 sm:px-6 py-3">
          <div className="rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-all shadow-sm">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isEmpty
                  ? "Ask anything…  (Enter to send, Shift+Enter for newline)"
                  : "Send a follow-up…"
              }
              rows={1}
              className="min-h-[48px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="gap-1 font-normal">
                  <Bot className="h-3 w-3" />
                  {selectedModelMeta?.displayName ?? selectedModel}
                </Badge>
                <span className="hidden sm:inline">
                  <CornerDownLeft className="inline h-3 w-3" /> to send
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isStreaming ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stopStreaming}
                    className="h-8"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => sendMessage()}
                    disabled={input.trim().length === 0}
                    className="h-8"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10.5px] text-muted-foreground text-center">
            Gemini may produce inaccurate information. Verify important outputs.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.error;

  return (
    <div className="flex gap-3 sm:gap-4">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-medium ${
          isUser
            ? "bg-foreground text-background"
            : isError
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              : "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium">{isUser ? "You" : "Gemini"}</span>
          {message.streaming && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
              </span>
              streaming
            </Badge>
          )}
          {!message.streaming && message.latencyMs !== undefined && (
            <Badge variant="outline" className="text-[10px] gap-1 py-0 px-1.5 font-normal">
              <Clock className="h-2.5 w-2.5" />
              {formatLatency(message.latencyMs)}
            </Badge>
          )}
          {isError && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
              error
            </Badge>
          )}
        </div>
        <div
          className={`prose prose-sm dark:prose-invert max-w-none break-words ${
            isError ? "text-rose-600 dark:text-rose-400" : ""
          }`}
        >
          {isUser ? (
            <p className="my-0 whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : message.content.length === 0 && message.streaming ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
              </span>
              <span>Thinking…</span>
            </div>
          ) : (
            <ReactMarkdown
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className?.includes("language-");
                  if (isInline) {
                    return (
                      <code
                        className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs">
                    {children}
                  </pre>
                ),
                a: ({ children, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 underline underline-offset-2 hover:opacity-80"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
