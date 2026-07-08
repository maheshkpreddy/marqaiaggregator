"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Shield, Zap, Users, Key } from "lucide-react";

interface AuthScreenProps {
  onSuccess: (data: {
    user: { id: string; email: string; name: string | null };
    org: { id: string; name: string; slug: string; plan: string };
  }) => void;
}

/**
 * AuthScreen — login + signup tabs. Shown when the user has no session.
 *
 * On success, calls `onSuccess` with the user + active org so the parent
 * can flip into the authenticated app shell.
 */
export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, orgName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Marketing panel */}
        <div className="hidden lg:block space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Marq AI Aggregator</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">One workspace for every model</p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Route prompts across OpenAI, Gemini, and Claude with automatic
            failover. Compare model outputs side-by-side. Run role-based agents.
            Expose it all to your apps via a unified, OpenAI-compatible API.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Feature icon={<Zap className="w-4 h-4" />} title="Auto-failover" body="If your primary model is down, requests route to the next in priority." />
            <Feature icon={<Shield className="w-4 h-4" />} title="Role-based access" body="Owner, admin, member, viewer roles per organization." />
            <Feature icon={<Users className="w-4 h-4" />} title="Multi-tenant" body="Each company gets an isolated workspace and team members." />
            <Feature icon={<Key className="w-4 h-4" />} title="Unified API" body="OpenAI-compatible /v1/chat/completions endpoint with API keys." />
          </div>
        </div>

        {/* Auth card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              {mode === "signup" ? "Create your workspace" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {mode === "signup"
                ? "Start using Marq AI in under a minute."
                : "Sign in to your Marq AI workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "login" | "signup"); setError(null); }}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="login">Log in</TabsTrigger>
              </TabsList>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div>
                    <Label htmlFor="su-name">Your name</Label>
                    <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required />
                  </div>
                  <div>
                    <Label htmlFor="su-email">Work email</Label>
                    <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" required />
                  </div>
                  <div>
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
                  </div>
                  <div>
                    <Label htmlFor="su-org">Organization name</Label>
                    <Input id="su-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." required minLength={2} />
                    <p className="text-xs text-slate-500 mt-1">Your team will share this workspace.</p>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Create workspace
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <Label htmlFor="li-email">Email</Label>
                    <Input id="li-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="jane@company.com" required />
                  </div>
                  <div>
                    <Label htmlFor="li-password">Password</Label>
                    <Input id="li-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Sign in
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <p className="text-xs text-slate-400 mt-4 text-center">
              By continuing you agree to use Marq AI for legitimate business purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}
