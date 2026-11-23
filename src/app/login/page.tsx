"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const DEMO_ACCOUNTS = [
  {
    name: "Iona Rollins",
    email: "iona@virtusms.io",
    role: "Super Admin",
    desc: "Full platform, RBAC & SMTP control",
  },
  {
    name: "Sandra Perry",
    email: "sandra@virtusms.io",
    role: "Service Manager",
    desc: "Operations, SLA, alerts & team leads",
  },
  {
    name: "Jamal Connolly",
    email: "jamal@virtusms.io",
    role: "Field Engineer",
    desc: "Corrective, preventive, implementations",
  },
  {
    name: "Antony Cardenas",
    email: "antony@virtusms.io",
    role: "Account Lead",
    desc: "Customers, partners, pipeline & services",
  },
  {
    name: "Marcus Vance",
    email: "marcus@virtusms.io",
    role: "Viewer",
    desc: "Read-only audit & compliance view",
  },
];

export default function LoginPage() {
  const { user, refreshAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("iona@virtusms.io");
  const [password, setPassword] = useState("virtus123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const signIn = async (targetEmail: string, targetPass: string) => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed");
        return;
      }
      await refreshAuth();
      router.replace("/");
    } catch {
      setError("Network error while signing in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn(email, password);
  };

  return (
    <div className="min-h-screen bg-[#F3F3EB] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white border border-[#E6E6DE] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(24,24,26,0.08)]">
        {/* Left: Login Form */}
        <div className="md:col-span-6 p-8 md:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <span className="w-7 h-7 rounded-[8px] bg-[#18181A] text-white text-[13px] font-semibold flex items-center justify-center">
                V
              </span>
              <span className="text-[20px] font-semibold tracking-tight text-[#18181A]">
                VirtusMS
              </span>
            </div>

            <h1 className="text-[24px] font-semibold tracking-tight text-[#18181A]">
              Management Service Team
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[#78787E]">
              Sign in with your role credentials to access maintenance queues, service contracts, pipeline, and alert automation.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#525258] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[10px] border border-[#E2E2DA] pl-9 pr-3 py-2.5 text-[13.5px] focus:outline-none focus:border-[#18181A]"
                    placeholder="name@virtusms.io"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#525258] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[10px] border border-[#E2E2DA] pl-9 pr-3 py-2.5 text-[13.5px] focus:outline-none focus:border-[#18181A]"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#18181A] hover:bg-[#2C2C30] text-white py-2.5 text-[13.5px] font-medium transition-colors disabled:opacity-50"
              >
                <span>{submitting ? "Signing in..." : "Sign in to workspace"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-8 pt-5 border-t border-[#F0F0EB] flex items-center gap-2 text-[12px] text-[#8E8E93]">
            <ShieldCheck className="w-4 h-4 text-[#525258]" />
            <span>PostgreSQL RBAC & session-cookie authentication active</span>
          </div>
        </div>

        {/* Right: Quick Role Switcher for Testing */}
        <div className="md:col-span-6 bg-[#19191B] text-white p-8 md:p-10 flex flex-col justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
              RBAC Demo Profiles (Password: virtus123)
            </div>
            <h2 className="mt-1.5 text-[18px] font-semibold">
              One-click Role Sign In
            </h2>
            <p className="mt-1 text-[12.5px] text-zinc-400">
              Test live permission boundaries across all modules and Team RBAC settings.
            </p>

            <div className="mt-6 space-y-2.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("virtus123");
                    void signIn(acc.email, "virtus123");
                  }}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-white">
                        {acc.name}
                      </span>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-200">
                        {acc.role}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-zinc-400 truncate">
                      {acc.desc}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 text-[11.5px] text-zinc-500">
            Default PostgreSQL instance · Automated Email Reminder Worker ready
          </div>
        </div>
      </div>
    </div>
  );
}
