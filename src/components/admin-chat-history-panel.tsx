"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Trash2,
  RotateCcw,
  Users,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronRight,
  Mail,
  Shield,
  History,
  AlertCircle,
} from "lucide-react";

/**
 * AdminChatHistoryPanel — org-owner-only view of ALL chat sessions in the
 * org, including soft-deleted ones, grouped by user.
 *
 * Why this exists:
 *  - When a user deletes a chat from their sidebar, it's soft-deleted
 *    (deletedAt is set). The chat disappears from the user's view but
 *    remains in the database.
 *  - Org owners (super admin) can see the full history here, organized
 *    user-wise, for audit / compliance / investigation purposes.
 *  - Owners can also restore a soft-deleted chat (clears deletedAt) or
 *    permanently hard-delete it.
 */

interface AdminSession {
  id: string;
  title: string;
  agentType: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  messageCount: number;
  lastMessage: string | null;
}

interface AdminUser {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  sessions: AdminSession[];
}

interface AdminData {
  users: AdminUser[];
  totals: {
    users: number;
    sessions: number;
    activeSessions: number;
    deletedSessions: number;
  };
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  model?: string | null;
  createdAt: string;
  provider?: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    icon: string;
  } | null;
}

export function AdminChatHistoryPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [viewingSession, setViewingSession] = useState<{
    session: AdminSession;
    userName: string;
  } | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions/admin");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      // Expand all users by default so the owner sees everything immediately.
      setExpandedUsers(new Set(json.users.map((u: AdminUser) => u.userId)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Failed to load chat history",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const viewSession = async (session: AdminSession, userName: string) => {
    setViewingSession({ session, userName });
    setSessionMessages([]);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/messages`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setSessionMessages(json.messages ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Failed to load messages",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const restoreSession = async (session: AdminSession) => {
    try {
      // Use a dedicated restore via PATCH on a special field — but since the
      // existing PATCH only renames, we'll call a custom action through the
      // DELETE route with a query param. Simpler: add a restore endpoint.
      // For now, we use the admin route with PATCH.
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({
        title: "Chat restored",
        description: `"${session.title}" is visible to the user again.`,
      });
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Restore failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const hardDeleteSession = async (session: AdminSession) => {
    if (
      !confirm(
        `Permanently delete "${session.title}"? This cannot be undone and will remove all messages.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${session.id}?permanent=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast({
        title: "Chat permanently deleted",
        description: `"${session.title}" has been removed from the database.`,
      });
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Delete failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const filteredUsers = (data?.users ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.userName.toLowerCase().includes(q) ||
      u.userEmail.toLowerCase().includes(q) ||
      u.sessions.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.lastMessage ?? "").toLowerCase().includes(q)
      )
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading chat history…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">No data available.</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-violet-500" />
            Chat History (Admin)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Full audit view of all conversations in this org — including ones
            users have deleted from their own sidebar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data.totals.users}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{data.totals.sessions}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total chats</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.totals.activeSessions}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {data.totals.deletedSessions}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Soft-deleted (hidden from users)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by user name, email, chat title, or message content…"
          className="pl-9"
        />
      </div>

      {/* User-wise chat list */}
      <div className="space-y-2">
        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {search
                ? "No users or chats match your search."
                : "No chat sessions in this org yet."}
            </CardContent>
          </Card>
        )}
        {filteredUsers.map((u) => {
          const isExpanded = expandedUsers.has(u.userId);
          const deletedCount = u.sessions.filter((s) => s.deletedAt).length;
          return (
            <Card key={u.userId}>
              <CardHeader className="p-3 sm:p-4 cursor-pointer hover:bg-accent/50 transition-colors" >
                <div
                  className="flex items-center justify-between gap-2"
                  onClick={() => toggleUser(u.userId)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {u.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-2">
                        {u.userName}
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            u.role === "owner"
                              ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"
                              : u.role === "admin"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          {u.role}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" />
                        {u.userEmail || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {u.sessions.length} chat{u.sessions.length !== 1 ? "s" : ""}
                    </Badge>
                    {deletedCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                        {deletedCount} deleted
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              {isExpanded && u.sessions.length > 0 && (
                <CardContent className="p-0">
                  <Separator />
                  <div className="divide-y divide-border">
                    {u.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 sm:p-4 hover:bg-accent/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => viewSession(s, u.userName)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {s.title || "Untitled conversation"}
                              </span>
                              {s.deletedAt && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                  deleted
                                </Badge>
                              )}
                              {s.agentType && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Users className="h-2.5 w-2.5" />
                                  agent: {s.agentType}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {s.lastMessage || "No messages"}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(s.updatedAt).toLocaleString()}
                              </span>
                              <span>{s.messageCount} message{s.messageCount !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => viewSession(s, u.userName)}
                            >
                              View
                            </Button>
                            {s.deletedAt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => restoreSession(s)}
                                title="Restore — make visible to the user again"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              onClick={() => hardDeleteSession(s)}
                              title="Permanently delete — cannot be undone"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
              {isExpanded && u.sessions.length === 0 && (
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No chat sessions for this user.
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Session viewer dialog */}
      <Dialog
        open={!!viewingSession}
        onOpenChange={(o) => !o && setViewingSession(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <MessageSquare className="h-4 w-4" />
              {viewingSession?.session.title || "Untitled conversation"}
              {viewingSession?.session.deletedAt && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  soft-deleted
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Conversation with {viewingSession?.userName} ·{" "}
              {viewingSession?.session.messageCount} message
              {viewingSession?.session.messageCount !== 1 ? "s" : ""} ·{" "}
              {viewingSession &&
                new Date(viewingSession.session.updatedAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 max-h-[55vh]">
            <div className="space-y-4 p-1">
              {loadingMessages && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  Loading messages…
                </div>
              )}
              {!loadingMessages && sessionMessages.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  No messages in this conversation.
                </div>
              )}
              {sessionMessages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className="flex gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-medium ${
                        isUser
                          ? "bg-foreground text-background"
                          : "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white"
                      }`}
                    >
                      {isUser ? "U" : "AI"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-2">
                        <span className="font-medium">
                          {isUser ? "User" : m.provider?.displayName ?? "Assistant"}
                        </span>
                        <span>·</span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                        {m.model && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1">
                            {m.model}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2.5">
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
