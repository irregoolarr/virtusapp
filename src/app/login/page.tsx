"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, EyeOff, ShieldCheck } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [showSsoNotice, setShowSsoNotice] = useState(false);
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);
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
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#FAF8F4]">
      {/* Mobile Compact Hero Strip */}
      <div className="lg:hidden relative h-44 w-full overflow-hidden bg-[#162333]">
        <Image
          src="/images/office-lobby.png"
          alt="Virtus Technology Indonesia Office Lobby"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#162333]/85 via-[#162333]/30 to-transparent" />
        <div className="absolute bottom-3.5 left-5 right-5 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-[#FAF8F4]/85">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C84B3C]" />
              <span>Management Service Team</span>
            </div>
            <div className="text-[15px] font-semibold text-white">
              Virtus Operations & SLA Portal
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#162333]/70 border border-white/15 text-[10px] font-medium tracking-[0.08em] uppercase text-[#FAF8F4]/90">
            CTI Group
          </span>
        </div>
      </div>

      {/* Left Column: Washi Form Panel */}
      <div className="lg:col-span-5 relative flex flex-col items-center justify-center px-6 py-10 sm:px-10 bg-[#FAF8F4] lg:border-r lg:border-[#E6DFD3]">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#1F3B5C] via-[#1F3B5C] to-[#B84336]" />

        <div className="w-full max-w-[360px]">
          <div className="mb-5">
            <Image
              src="/images/virtus-logo.png"
              alt="Virtus — a member of CTI Group"
              width={160}
              height={170}
              priority
              className="h-[74px] w-auto object-contain"
            />
          </div>

          <h1 className="text-[30px] leading-[1.18] font-bold tracking-tight text-[#1C2127]">
            Welcome to
            <br />
            VirtusMS Portal
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-[12px] font-medium text-[#6E6860] mb-1.5"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-[8px] border border-[#DDD5C9] bg-white px-3 py-2.5 text-[13.5px] text-[#1C2127] placeholder:text-[#9B948B] focus:outline-none focus:border-[#1F3B5C] focus:ring-2 focus:ring-[#1F3B5C]/15 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[12px] font-medium text-[#6E6860] mb-1.5"
              >
                Password
              </label>
              <div className="flex items-stretch rounded-[8px] border border-[#DDD5C9] bg-white overflow-hidden focus-within:border-[#1F3B5C] focus-within:ring-2 focus-within:ring-[#1F3B5C]/15 transition-colors">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13.5px] text-[#1C2127] placeholder:text-[#9B948B] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="px-3 bg-[#EDE9E0] hover:bg-[#E4DFD4] text-[#6E6860] hover:text-[#1C2127] border-l border-[#DDD5C9] flex items-center justify-center transition-colors"
                >
                  {showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotHelp((prev) => !prev)}
                className="text-[12px] font-medium text-[#B84336] hover:text-[#963126] transition-colors"
              >
                Forgot password
              </button>
            </div>

            {showForgotHelp && (
              <div className="rounded-[8px] border border-[#E6DFD3] bg-[#F2EDE4] px-3 py-2.5 text-[12px] leading-relaxed text-[#6E6860]">
                Contact your Super Admin (
                <span className="font-medium text-[#1C2127]">iona@virtusms.io</span>
                ) to reset credentials in Team &amp; RBAC, or sign in using a Demo RBAC profile below.
              </div>
            )}

            {error && (
              <div className="rounded-[8px] bg-[#FDF2F0] border border-[#E5B8B1] px-3 py-2 text-[12.5px] text-[#9A2F24]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-[8px] bg-[#1F3B5C] hover:bg-[#162C46] text-white py-2.5 text-[13.5px] font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E6DFD3]" />
            <span className="text-[12px] text-[#6E6860]">Or</span>
            <div className="flex-1 h-px bg-[#E6DFD3]" />
          </div>

          {/* Secondary Auth Options */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setShowSsoNotice((prev) => !prev)}
              className="w-full rounded-[8px] border border-[#DDD5C9] bg-white hover:bg-[#F2EDE4]/60 px-3.5 py-2.5 text-[13px] font-medium text-[#1C2127] flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect x="1" y="1" width="6.5" height="6.5" fill="#F25022" />
                <rect x="8.5" y="1" width="6.5" height="6.5" fill="#7FBA00" />
                <rect x="1" y="8.5" width="6.5" height="6.5" fill="#00A4EF" />
                <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFB900" />
              </svg>
              <span>Sign in with Microsoft</span>
            </button>

            {showSsoNotice && (
              <div className="rounded-[8px] border border-[#E6DFD3] bg-[#F2EDE4] px-3 py-2 text-[12px] text-[#6E6860]">
                Microsoft Entra SSO is not configured on this local instance yet. Please use your email and password or a Demo RBAC profile below.
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowDemoProfiles((prev) => !prev)}
              aria-expanded={showDemoProfiles}
              className="w-full rounded-[8px] border border-[#DDD5C9] bg-white hover:bg-[#F2EDE4]/60 px-3.5 py-2.5 text-[13px] font-medium text-[#1C2127] flex items-center justify-between gap-2 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1F3B5C] shrink-0" />
                <span>Quick Demo Sign-In (RBAC Profiles)</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#6E6860] transition-transform ${
                  showDemoProfiles ? "rotate-180" : ""
                }`}
              />
            </button>

            {showDemoProfiles && (
              <div className="rounded-[10px] border border-[#DDD5C9] bg-white p-2 space-y-1.5">
                <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-[#6E6860]">
                  Password for all seeded roles:{" "}
                  <span className="font-mono text-[#1C2127]">virtus123</span>
                </div>
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
                    className="w-full text-left rounded-[8px] border border-transparent hover:border-[#DDD5C9] hover:bg-[#FAF8F4] px-2.5 py-2 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-[#1C2127]">
                        {acc.name}
                      </span>
                      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#F2EDE4] text-[#1F3B5C] border border-[#E6DFD3]">
                        {acc.role}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#6E6860] truncate">
                      {acc.email} · {acc.desc}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <footer className="mt-7 text-center text-[11.5px] leading-[1.6] text-[#9B948B]">
            <div>Copyright Virtus Technology Indonesia · CTI Group 2026 ©</div>
            <div>All rights reserved.</div>
            <div>Version 1.0.0</div>
          </footer>
        </div>
      </div>

      {/* Right Column: Full-Bleed Office Lobby */}
      <div className="hidden lg:block lg:col-span-7 relative overflow-hidden bg-[#162333]">
        <Image
          src="/images/office-lobby.png"
          alt="Virtus Technology Indonesia Office Lobby"
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#162333]/80 via-[#162333]/10 to-transparent" />

        <div className="absolute bottom-7 inset-x-7 flex items-end justify-between gap-4">
          <div className="bg-[#162333]/65 backdrop-blur-md border border-white/15 rounded-xl px-5 py-4 max-w-md text-white">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#FAF8F4]/85">
              <span className="w-2 h-2 rounded-full bg-[#C84B3C]" />
              <span>Management Service Team</span>
            </div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-white">
              Virtus Operations &amp; SLA Portal
            </h2>
            <p className="mt-1 text-[12.5px] text-white/80 leading-relaxed">
              Unified workspace for corrective &amp; preventive maintenance, service contracts, POCs, pipeline, and automated SLA alerting.
            </p>
          </div>

          <div className="bg-[#162333]/65 backdrop-blur-md border border-white/15 rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-[0.1em] uppercase text-[#FAF8F4]/90 shrink-0">
            CTI GROUP · JAKARTA
          </div>
        </div>
      </div>
    </div>
  );
}
