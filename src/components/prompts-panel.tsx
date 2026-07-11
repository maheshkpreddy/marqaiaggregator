"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Pencil, Loader2, BookMarked, Copy } from "lucide-react";

interface Prompt {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string;
  updatedAt: string;
}

interface PromptsPanelProps {
  /** Optional callback when the user picks a prompt (e.g. to load into chat) */
  onUse?: (body: string) => void;
}

export function PromptsPanel({ onUse }: PromptsPanelProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  // New/edit form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState("general");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/prompts?${params.toString()}`);
      const d = await res.json();
      if (res.ok) setPrompts(d.prompts ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setTitle(""); setBody(""); setCat("general"); setTags("");
    setEditing(null);
    setCreateOpen(true);
  }

  function openEdit(p: Prompt) {
    setTitle(p.title); setBody(p.body); setCat(p.category); setTags(p.tags);
    setEditing(p);
    setCreateOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/prompts/${editing.id}` : "/api/prompts";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category: cat, tags }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      toast({ title: editing ? "Prompt updated" : "Prompt saved" });
      setCreateOpen(false);
      load();
    } catch (err) {
      toast({
        title: "Could not save prompt",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this prompt?")) return;
    try {
      const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Delete failed");
      }
      toast({ title: "Prompt deleted" });
      load();
    } catch (err) {
      toast({
        title: "Could not delete prompt",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  function copyBody(b: string) {
    navigator.clipboard.writeText(b);
    toast({ title: "Copied to clipboard" });
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><BookMarked className="w-5 h-5" /> Prompt Library</CardTitle>
            <CardDescription>Reusable prompts shared across your team</CardDescription>
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New prompt</Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search prompts…"
                className="pl-8"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-background text-sm"
            >
              <option value="all">All categories</option>
              <option value="general">General</option>
              <option value="engineering">Engineering</option>
              <option value="writing">Writing</option>
              <option value="analysis">Analysis</option>
              <option value="sales">Sales</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No prompts yet. Click "New prompt" to save your first reusable prompt.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {prompts.map((p) => (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{p.title}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">{p.category}</Badge>
                          {p.tags && p.tags.split(",").filter(Boolean).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t.trim()}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-4 mb-3 whitespace-pre-wrap">
                      {p.body}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      {onUse && (
                        <Button size="sm" variant="ghost" onClick={() => onUse(p.body)}>
                          Use
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => copyBody(p.body)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit prompt" : "New prompt"}</DialogTitle>
            <DialogDescription>Save a reusable prompt for your team.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label htmlFor="p-title">Title</Label>
              <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-cat">Category</Label>
                <Input id="p-cat" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="general" />
              </div>
              <div>
                <Label htmlFor="p-tags">Tags (comma-separated)</Label>
                <Input id="p-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sql, refactor" />
              </div>
            </div>
            <div>
              <Label htmlFor="p-body">Prompt body</Label>
              <Textarea id="p-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} required />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? "Save changes" : "Save prompt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
