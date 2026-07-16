"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Wand2,
  Key,
  Trash2,
  Copy,
  Check,
  Loader2,
  Zap,
  Shield,
  ArrowRight,
  Plus,
  Sparkles,
  Code2,
  AlertCircle,
} from "lucide-react";

/**
 * CustomApiBuilderPanel — lets users describe a requirement in natural
 * language, get an AI-suggested provider chain (open-source first, paid
 * fallback), and generate a unified API key scoped to that chain.
 *
 * The generated key hits POST /api/v1/custom/chat/completions which routes
 * ONLY through the configured providers — faster and more reliable than
 * the full 30+ provider failover.
 */

interface SuggestedProvider {
  id: string;
  name: string;
  displayName: string;
  tier: "open_source" | "paid";
  hasKey: boolean;
  rationale: string;
}

interface BuildResult {
  providers: SuggestedProvider[];
  overallRationale: string;
  suggestedName: string;
  openSourceFirst: boolean;
}

interface CustomApi {
  id: string;
  name: string;
  description: string | null;
  rationale: string | null;
  openSourceFirst: boolean;
  timeoutMs: number;
  createdAt: string;
  providerIds: string[];
  providers: Array<{
    id: string;
    name: string;
    displayName: string;
    color: string;
    icon: string;
  }>;
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string;
    lastUsedAt: string | null;
    revoked: boolean;
  } | null;
}

const EXAMPLE_REQUIREMENTS = [
  "I need a fast, free chat API for a customer support bot. Must be reliable and low-latency.",
  "I want a code-generation API that prefers open-source models but falls back to GPT-4 if needed.",
  "Build me a reasoning API that uses the strongest available model, with free providers as backup.",
  "I need a simple chat API for prototyping — free only, no API keys required.",
];

export function CustomApiBuilderPanel({ auth }: { auth: { role: string } }) {
  const { toast } = useToast();
  const canManage = auth.role === "owner" || auth.role === "admin";

  const [requirement, setRequirement] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [customName, setCustomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [customApis, setCustomApis] = useState<CustomApi[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadCustomApis = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/custom-apis");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCustomApis(data.customApis ?? []);
    } catch (err) {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadCustomApis();
  }, [loadCustomApis]);

  const analyze = async () => {
    if (requirement.trim().length < 10) {
      toast({
        title: "Requirement too short",
        description: "Please describe your requirement in at least 10 characters.",
        variant: "destructive",
      });
      return;
    }
    setAnalyzing(true);
    setBuildResult(null);
    try {
      const res = await fetch("/api/custom-apis/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement, maxProviders: 4 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: BuildResult = await res.json();
      setBuildResult(data);
      setCustomName(data.suggestedName);
      toast({
        title: "Provider chain ready",
        description: `${data.providers.length} providers selected — review and generate your key.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Analysis failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const generateKey = async () => {
    if (!buildResult) return;
    if (customName.trim().length < 2) {
      toast({
        title: "Name required",
        description: "Please give your custom API a name.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/custom-apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          description: requirement.trim(),
          rationale: buildResult.overallRationale,
          providerIds: buildResult.providers.map((p) => p.id),
          openSourceFirst: buildResult.openSourceFirst,
          timeoutMs: 12000,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNewKeyToken(data.token);
      setBuildResult(null);
      setRequirement("");
      await loadCustomApis();
      toast({
        title: "Custom API created",
        description: "Your unified key is ready — copy it now, it won't be shown again.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Failed to create",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const revokeApi = async (id: string) => {
    if (!confirm("Revoke this custom API? The key will stop working immediately.")) return;
    try {
      const res = await fetch(`/api/custom-apis/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await loadCustomApis();
      toast({ title: "Custom API revoked" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Revoke failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-violet-500" />
          Custom API Builder
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Describe your requirement in plain English. The AI picks a small,
          fast chain of providers — <strong>open-source first</strong> (free,
          no API key needed, never hits billing issues), paid providers only as
          fallback. You get a single unified API key that routes only through
          your chosen chain, so there's no failover lag from the full 30+
          provider list.
        </p>
      </div>

      {/* Builder card */}
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Step 1 — Describe your requirement
            </CardTitle>
            <CardDescription>
              The more specific you are, the better the provider selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="e.g. I need a fast, free chat API for a customer support bot. Must be reliable, low-latency, and work without any API keys. Fall back to GPT-4 only if the free providers can't handle complex queries."
                rows={4}
                className="resize-y"
              />
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_REQUIREMENTS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setRequirement(ex)}
                    className="text-[11px] px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-left"
                  >
                    {ex.slice(0, 60)}
                    {ex.length > 60 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={analyze}
              disabled={analyzing || requirement.trim().length < 10}
              className="w-full sm:w-auto"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing providers…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Analyze & suggest providers
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Admin access required
              </p>
              <p className="text-amber-600 dark:text-amber-500/80 mt-1">
                Only org admins and owners can build custom APIs. Ask your org
                owner to grant you admin access, or ask them to build one for
                you.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Build result — provider chain preview */}
      {buildResult && (
        <Card className="border-violet-200 dark:border-violet-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-violet-500" />
              Step 2 — Review the suggested provider chain
            </CardTitle>
            <CardDescription>{buildResult.overallRationale}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider chain */}
            <div className="space-y-2">
              {buildResult.providers.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{p.displayName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${
                          p.tier === "open_source"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                        }`}
                      >
                        <Shield className="h-2.5 w-2.5" />
                        {p.tier === "open_source" ? "Free" : "Paid"}
                      </Badge>
                      {p.hasKey ? (
                        <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/40">
                          <Key className="h-2.5 w-2.5" />
                          live key
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-slate-500">
                          no key (demo)
                        </Badge>
                      )}
                      {i === 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          primary
                        </Badge>
                      )}
                      {i === buildResult.providers.length - 1 && i > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-slate-500">
                          last resort
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.rationale}</p>
                  </div>
                  {i < buildResult.providers.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 hidden sm:block" />
                  )}
                </div>
              ))}
            </div>

            {/* Name input + generate */}
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label htmlFor="custom-api-name">Custom API name</Label>
                <Input
                  id="custom-api-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. support_bot_fast"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={generateKey} disabled={creating} className="flex-1">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating key…
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Generate unified API key
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBuildResult(null)}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The key will be scoped to only these {buildResult.providers.length}{" "}
                providers. Calls hit{" "}
                <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                  POST /api/v1/custom/chat/completions
                </code>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New key token dialog */}
      <Dialog open={!!newKeyToken} onOpenChange={(o) => !o && setNewKeyToken(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-500" />
              Custom API key generated
            </DialogTitle>
            <DialogDescription>
              Copy this key now — it won't be shown again. Treat it like a
              password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/50 p-3 font-mono text-sm break-all">
              {newKeyToken}
            </div>
            <Button
              onClick={() => newKeyToken && copyToken(newKeyToken)}
              className="w-full"
              variant={copied ? "default" : "outline"}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy key
                </>
              )}
            </Button>
            <div className="rounded-lg border p-3 text-xs space-y-2">
              <div className="font-medium flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                Quick start
              </div>
              <pre className="text-[10px] overflow-x-auto bg-muted/50 p-2 rounded">
{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/v1/custom/chat/completions \\
  -H "Authorization: Bearer ${newKeyToken ? newKeyToken.slice(0, 20) + "..." : "marq_live_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'`}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing custom APIs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            Your custom APIs ({customApis.length})
          </h3>
          {canManage && customApis.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBuildResult(null);
                setRequirement("");
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New
            </Button>
          )}
        </div>

        {loadingList ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Loading…
          </div>
        ) : customApis.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No custom APIs yet. Describe a requirement above to build your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {customApis.map((api) => (
              <Card key={api.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{api.name}</span>
                        {api.apiKey?.revoked && (
                          <Badge variant="destructive" className="text-[10px]">
                            revoked
                          </Badge>
                        )}
                        {api.openSourceFirst && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30">
                            <Shield className="h-2.5 w-2.5" />
                            open-source first
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {api.timeoutMs / 1000}s timeout
                        </Badge>
                      </div>
                      {api.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {api.description}
                        </p>
                      )}
                      {api.rationale && (
                        <p className="text-[11px] text-muted-foreground/80 mt-1 italic">
                          {api.rationale}
                        </p>
                      )}
                    </div>
                    {canManage && !api.apiKey?.revoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                        onClick={() => revokeApi(api.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Revoke
                      </Button>
                    )}
                  </div>

                  {/* Provider chain */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {api.providers.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        {i > 0 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                        )}
                        <Badge
                          variant="secondary"
                          className="text-[10px] gap-1"
                          style={{
                            borderColor: p.color + "40",
                          }}
                        >
                          {p.displayName}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Key info + endpoint */}
                  {api.apiKey && !api.apiKey.revoked && (
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground pt-1 border-t">
                      <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                        {api.apiKey.keyPrefix}…
                      </code>
                      <span>·</span>
                      <span>
                        Last used:{" "}
                        {api.apiKey.lastUsedAt
                          ? new Date(api.apiKey.lastUsedAt).toLocaleString()
                          : "never"}
                      </span>
                      <span>·</span>
                      <code className="font-mono text-[10px]">
                        POST /api/v1/custom/chat/completions
                      </code>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
