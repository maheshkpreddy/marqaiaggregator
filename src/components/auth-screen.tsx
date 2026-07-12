"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Loader2, Shield, Zap, Users, Key, ArrowRight, CheckCircle2,
  GitBranch, Network, BarChart3, Lock, Cpu, Globe, Workflow,
} from "lucide-react";

interface AuthScreenProps {
  onSuccess: (data: {
    user: { id: string; email: string; name: string | null };
    org: { id: string; name: string; slug: string; plan: string };
  }) => void;
}

/**
 * AuthScreen — elegant split-screen login + signup.
 *
 * Left panel: brand + animated infographic showcasing the SaaS architecture
 * (multi-provider routing, failover, unified API).
 * Right panel: clean auth card.
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

  // Animated counter for "requests routed"
  const [routedCount, setRoutedCount] = useState(2847291);
  useEffect(() => {
    const id = setInterval(() => setRoutedCount((c) => c + Math.floor(Math.random() * 7) + 1), 1800);
    return () => clearInterval(id);
  }, []);

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
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex items-center justify-center p-4">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-violet-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[140px]" />

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-6xl grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        {/* ───────── LEFT: Brand + Infographic ───────── */}
        <div className="hidden lg:block space-y-7">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
              <Sparkles className="w-6 h-6 text-white" strokeWidth={2.5} />
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 opacity-30 blur-md -z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Marq <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">AI</span>
              </h1>
              <p className="text-xs text-slate-400 -mt-0.5">Unified AI Aggregator · SaaS Platform</p>
            </div>
          </div>

          {/* Hero headline */}
          <div className="space-y-2">
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
              One unified gateway to{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                every AI model
              </span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              Route prompts across OpenAI, Anthropic, Gemini, Grok, Zai, and 50+ open-source
              models with automatic failover. Compare outputs side-by-side. Expose it all to
              your apps via a single OpenAI-compatible API.
            </p>
          </div>

          {/* Infographic: Provider routing diagram */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 overflow-hidden">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Live routing topology
            </div>

            {/* The diagram: 1 client → Marq core → 4 providers */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
              {/* Client */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-300" />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Your App</span>
              </div>

              {/* Connecting lines + Marq core */}
              <div className="relative h-20 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                      <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>
                  {/* left → center */}
                  <path d="M 0 40 L 90 40" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" strokeDasharray="4 3">
                    <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.2s" repeatCount="indefinite" />
                  </path>
                  {/* center → 4 providers */}
                  <path d="M 110 40 Q 150 40 200 8"  stroke="url(#line-grad)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
                  <path d="M 110 40 Q 150 40 200 28" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
                  <path d="M 110 40 Q 150 40 200 52" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
                  <path d="M 110 40 Q 150 40 200 72" stroke="url(#line-grad)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
                </svg>
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <Workflow className="w-7 h-7 text-white" strokeWidth={2.2} />
                </div>
              </div>

              {/* Providers */}
              <div className="flex flex-col gap-1.5">
                {[
                  { name: "OpenAI",   color: "#10a37f", icon: Sparkles },
                  { name: "Claude",   color: "#d97757", icon: Cpu },
                  { name: "Gemini",   color: "#4285f4", icon: Globe },
                  { name: "Local",    color: "#94a3b8", icon: Network },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: p.color }} />
                    <span className="text-[10px] font-medium text-slate-200">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live counter */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Requests routed</div>
                <div className="text-lg font-bold tabular-nums bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                  {routedCount.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All systems operational
              </div>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfographicFeature
              icon={<Zap className="w-4 h-4" />}
              title="Auto-failover"
              body="If your primary model is down, requests route to the next in priority — zero user-visible downtime."
              accent="from-amber-400 to-orange-500"
            />
            <InfographicFeature
              icon={<GitBranch className="w-4 h-4" />}
              title="Compare mode"
              body="Run one prompt across N providers in parallel. See latency, tokens, and outputs side-by-side."
              accent="from-violet-400 to-fuchsia-500"
            />
            <InfographicFeature
              icon={<Lock className="w-4 h-4" />}
              title="Role-based access"
              body="Owner, admin, member, viewer roles per organization. API keys scoped per team."
              accent="from-blue-400 to-cyan-500"
            />
            <InfographicFeature
              icon={<BarChart3 className="w-4 h-4" />}
              title="SaaS unified API"
              body="One OpenAI-compatible /v1 endpoint for corporates & third-party products."
              accent="from-emerald-400 to-teal-500"
            />
          </div>

          {/* Trust row */}
          <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-2">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" />SOC2-ready</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />99.95% SLA</span>
            <span className="flex items-center gap-1"><Key className="w-3 h-3" />Per-tenant keys</span>
          </div>
        </div>

        {/* ───────── RIGHT: Auth card ───────── */}
        <div className="relative">
          {/* Glow behind card */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-violet-500/30 blur-2xl -z-10" />

          <Card className="bg-white/[0.04] border-white/10 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-3">
              {/* Mobile brand */}
              <div className="lg:hidden flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white">Marq AI</div>
                  <div className="text-[10px] text-slate-400">Unified AI Aggregator</div>
                </div>
              </div>

              <CardTitle className="flex items-center gap-2 text-white text-xl">
                {mode === "signup" ? "Create your workspace" : "Welcome back"}
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </CardTitle>
              <CardDescription className="text-slate-400">
                {mode === "signup"
                  ? "Start using Marq AI in under a minute. No credit card required."
                  : "Sign in to your Marq AI workspace."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => { setMode(v as "login" | "signup"); setError(null); }}>
                <TabsList className="grid w-full grid-cols-2 mb-5 bg-white/[0.04] border border-white/10">
                  <TabsTrigger
                    value="signup"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white text-slate-300"
                  >
                    Sign up
                  </TabsTrigger>
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white text-slate-300"
                  >
                    Log in
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-3">
                    <div>
                      <Label htmlFor="su-name" className="text-slate-300">Your name</Label>
                      <Input
                        id="su-name" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe" required
                        className="mt-1 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-email" className="text-slate-300">Work email</Label>
                      <Input
                        id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@company.com" required
                        className="mt-1 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-password" className="text-slate-300">Password</Label>
                      <Input
                        id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters" required minLength={8}
                        className="mt-1 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-org" className="text-slate-300">Organization name</Label>
                      <Input
                        id="su-org" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Inc." required minLength={2}
                        className="mt-1 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/20"
                      />
                      <p className="text-xs text-slate-500 mt-1">Your team will share this workspace.</p>
                    </div>
                    {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-2">{error}</p>}
                    <Button
                      type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/30"
                    >
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Create workspace
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div>
                      <Label htmlFor="li-email" className="text-slate-300">Email</Label>
                      <Input
                        id="li-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="jane@company.com" required
                        className="mt-1 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="li-password" className="text-slate-300">Password</Label>
                      <Input
                        id="li-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••" required
                        className="mt-1 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/20"
                      />
                    </div>
                    {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-2">{error}</p>}
                    <Button
                      type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/30"
                    >
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Sign in
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              <p className="text-[11px] text-slate-500 mt-5 text-center leading-relaxed">
                By continuing you agree to use Marq AI for legitimate business purposes.
                <br />Your data is encrypted in transit and at rest.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfographicFeature({
  icon, title, body, accent,
}: { icon: React.ReactNode; title: string; body: string; accent: string }) {
  return (
    <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-sm`}>
          {icon}
        </div>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-snug">{body}</p>
    </div>
  );
}
