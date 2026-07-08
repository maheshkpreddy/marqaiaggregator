"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Copy, Loader2, CheckCircle2, Code2 } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeysPanelProps {
  auth: { role: string };
}

export function ApiKeysPanel({ auth }: ApiKeysPanelProps) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["chat", "compare", "agents"]);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const canManage = auth.role === "owner" || auth.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      const d = await res.json();
      if (res.ok) setKeys(d.apiKeys ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes: selectedScopes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create");
      setNewToken(d.token);
      setCreateOpen(false);
      setName("");
      setSelectedScopes(["chat", "compare", "agents"]);
      load();
    } catch (err) {
      toast({
        title: "Could not create API key",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, keyName: string) {
    if (!confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to revoke");
      }
      toast({ title: "API key revoked" });
      load();
    } catch (err) {
      toast({
        title: "Could not revoke key",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleScope(s: string) {
    setSelectedScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  const codeSample = `curl https://marqaiaggregator.vercel.app/api/v1/chat/completions \\
  -H "Authorization: Bearer marq_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, which model am I talking to?"}
    ]
  }'`;

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Use these keys to authenticate external apps calling the unified Marq API.
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> New key
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No API keys yet. {canManage ? "Create one to start integrating." : "Ask an admin to create one."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  {canManage && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell><code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{k.keyPrefix}…</code></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.split(",").map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id, k.name)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code2 className="w-5 h-5" /> Quick start: unified API</CardTitle>
          <CardDescription>OpenAI-compatible endpoint. Drop-in for any client that calls OpenAI.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-4 overflow-auto"><code>{codeSample}</code></pre>
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <div>Available endpoints:</div>
            <ul className="list-disc ml-6 space-y-0.5">
              <li><code>POST /api/v1/chat/completions</code> — OpenAI-compatible chat with auto-failover</li>
              <li><code>POST /api/v1/compare</code> — Run one prompt across multiple models in parallel</li>
              <li><code>POST /api/v1/agents/run</code> — Run a role-based agent task synchronously</li>
              <li><code>GET /api/v1/models</code> — List all available models across providers</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>The full key will only be shown once. Store it securely.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label htmlFor="ak-name">Name</Label>
              <Input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server" required />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {["chat", "compare", "agents", "read"].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(s)}
                      onChange={() => toggleScope(s)}
                      className="rounded"
                    />
                    <code>{s}</code>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={creating || selectedScopes.length === 0}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newToken} onOpenChange={(o) => { if (!o) setNewToken(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              API key created
            </DialogTitle>
            <DialogDescription>
              Copy this key now. For security, it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded break-all">
                {newToken}
              </code>
              <Button size="sm" onClick={copyToken}>
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button>Done</Button></DialogClose>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
