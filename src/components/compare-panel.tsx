"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare, CheckCircle2, XCircle, Clock, Hash } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  priority: number;
}

interface CompareResult {
  providerId: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  content: string | null;
  model: string | null;
  latencyMs: number;
  tokensUsed: number | null;
  error: string | null;
}

interface ComparePanelProps {
  providers: Provider[];
}

export function ComparePanel({ providers }: ComparePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(providers.map((p) => p.id)));
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    if (!prompt.trim()) {
      setError("Enter a prompt to compare");
      return;
    }
    if (selected.size < 2) {
      setError("Select at least 2 providers");
      return;
    }
    setError(null);
    setRunning(true);
    setResults(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          systemPrompt: systemPrompt || undefined,
          providerIds: Array.from(selected),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Compare failed");
      setResults(d.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setRunning(false);
    }
  }

  const selectedProviders = providers.filter((p) => selected.has(p.id));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Model Comparison
          </CardTitle>
          <CardDescription>
            Run the same prompt across multiple providers in parallel and compare outputs side-by-side.
            No failover — each provider returns its raw result so you can judge which model is best.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sys-prompt">System prompt (optional)</Label>
            <Input
              id="sys-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="cmp-prompt">Prompt</Label>
            <Textarea
              id="cmp-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Explain the CAP theorem in one paragraph."
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="mb-2 block">Providers ({selected.size} selected)</Label>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? "border-transparent text-white" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                    style={on ? { backgroundColor: p.color } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: on ? "rgba(255,255,255,0.5)" : p.color }} />
                    {p.displayName}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={running || selected.size < 2 || !prompt.trim()}>
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitCompare className="w-4 h-4 mr-2" />}
              Run comparison
            </Button>
            {selected.size > 0 && (
              <span className="text-sm text-slate-500">
                Will run in parallel across {selectedProviders.map((p) => p.displayName).join(", ")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {results && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(results.length, 3)}, minmax(0, 1fr))` }}>
          {results.map((r) => (
            <Card key={r.providerId} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.displayName}
                  </CardTitle>
                  {r.error ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>
                {r.model && <Badge variant="outline" className="text-xs w-fit">{r.model}</Badge>}
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {r.error ? (
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                    {r.error}
                  </div>
                ) : (
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {r.content}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 border-t pt-2">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.latencyMs}ms</span>
                  {r.tokensUsed != null && (
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{r.tokensUsed} tok</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
