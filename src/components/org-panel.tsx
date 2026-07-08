"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Trash2, Loader2, Crown, Shield, User, Eye, Building2, Pencil } from "lucide-react";

interface OrgData {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    seatsTotal: number;
    seatsUsed: number;
  };
  members: Array<{
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null };
    createdAt: string;
  }>;
  currentUserId: string;
  currentUserRole: string;
}

interface OrganizationPanelProps {
  /** Active auth context */
  auth: { user: { id: string; email: string; name: string | null }; org: { id: string; name: string; slug: string; plan: string }; role: string };
}

const roleIcon: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  member: <User className="w-3 h-3" />,
  viewer: <Eye className="w-3 h-3" />,
};

const roleColor: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  member: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  viewer: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

export function OrganizationPanel({ auth }: OrganizationPanelProps) {
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [orgName, setOrgName] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org");
      const d = await res.json();
      if (res.ok) setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canManage = auth.role === "owner" || auth.role === "admin";
  const canEditOrg = auth.role === "owner" || auth.role === "admin";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to invite");
      toast({ title: "Member added", description: `${inviteEmail} is now a ${inviteRole}` });
      setInviteOpen(false);
      setInviteEmail("");
      load();
    } catch (err) {
      toast({
        title: "Could not add member",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    try {
      const res = await fetch("/api/org/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, role: newRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to update role");
      toast({ title: "Role updated" });
      load();
    } catch (err) {
      toast({
        title: "Could not update role",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleRemove(membershipId: string, email: string) {
    if (!confirm(`Remove ${email} from this organization?`)) return;
    try {
      const res = await fetch(`/api/org/members?membershipId=${membershipId}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to remove");
      toast({ title: "Member removed" });
      load();
    } catch (err) {
      toast({
        title: "Could not remove member",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleSaveName() {
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to update");
      toast({ title: "Organization renamed" });
      setEditingName(false);
      load();
    } catch (err) {
      toast({
        title: "Could not rename org",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization
          </CardTitle>
          <CardDescription>Your team's workspace on Marq AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase text-slate-500">Name</Label>
              {editingName ? (
                <div className="flex gap-2 mt-1">
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  <Button size="sm" onClick={handleSaveName}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-medium">{data.org.name}</span>
                  {canEditOrg && (
                    <Button size="sm" variant="ghost" onClick={() => { setOrgName(data.org.name); setEditingName(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Slug</Label>
              <div className="text-lg font-mono text-slate-600 dark:text-slate-300 mt-1">{data.org.slug}</div>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Plan</Label>
              <div className="mt-1"><Badge className="capitalize">{data.org.plan}</Badge></div>
            </div>
            <div>
              <Label className="text-xs uppercase text-slate-500">Seats</Label>
              <div className="text-lg font-medium mt-1">{data.org.seatsUsed} / {data.org.seatsTotal} used</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members
            </CardTitle>
            <CardDescription>Manage who has access to this workspace</CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)} disabled={data.org.seatsUsed >= data.org.seatsTotal}>
              <UserPlus className="w-4 h-4 mr-1" /> Add member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {(m.user.name || m.user.email).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">
                      {m.user.name || m.user.email}
                      {m.user.id === data.currentUserId && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                    </div>
                    <div className="text-xs text-slate-500">{m.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`gap-1 ${roleColor[m.role]}`}>
                    {roleIcon[m.role]}
                    <span className="capitalize">{m.role}</span>
                  </Badge>
                  {canManage && m.role !== "owner" && m.user.id !== data.currentUserId && (
                    <>
                      <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v)}>
                        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(m.id, m.user.email)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a member</DialogTitle>
            <DialogDescription>
              The person must already have a Marq AI account with this email.
              Ask them to sign up first if they don't.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="inv-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="inv-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — manage members + API keys</SelectItem>
                  <SelectItem value="member">Member — full app use, can't manage team</SelectItem>
                  <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
