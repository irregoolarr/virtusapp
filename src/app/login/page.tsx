"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/** Page to return to after signing in (set when a session expired); only same-site paths. */
function returnPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  // Same-site paths only: "//host" and "/\\host" would leave the site.
  return /^\/(?![\/\\])/.test(next) && !next.startsWith("/login") ? next : "/";
}

export default function LoginPage() {
  const { user, refreshAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [showSsoNotice, setShowSsoNotice] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(returnPath());
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
      router.replace(returnPath());
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
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#FFFFFF]">
      {/* Mobile Compact Hero Strip */}
      <div className="lg:hidden relative h-44 w-full overflow-hidden bg-[#18181B]">
        <Image
          src="/images/office-lobby.png"
          alt="Virtus Technology Indonesia Office Lobby"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Left Column: Form Panel */}
      <div className="lg:col-span-5 relative flex flex-col items-center justify-center px-6 py-10 sm:px-10 bg-[#FFFFFF] lg:border-r lg:border-[#E4E4E7]">

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

          <h1 className="text-[28px] leading-[1.2] font-bold tracking-tight text-[#18181B]">
            Welcome to
            <br />
            Virtus Management System Portal
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-[12px] font-medium text-[#52525B] mb-1.5"
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
                className="w-full rounded-[8px] border border-[#D4D4D8] bg-white px-3 py-2.5 text-[13.5px] text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#A4CDE5] focus:ring-2 focus:ring-[#A4CDE5]/40 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[12px] font-medium text-[#52525B] mb-1.5"
              >
                Password
              </label>
              <div className="flex items-stretch rounded-[8px] border border-[#D4D4D8] bg-white overflow-hidden focus-within:border-[#A4CDE5] focus-within:ring-2 focus-within:ring-[#A4CDE5]/40 transition-colors">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13.5px] text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="px-3 bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#52525B] hover:text-[#18181B] border-l border-[#D4D4D8] flex items-center justify-center transition-colors"
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
                className="text-[12px] font-medium text-[#2F6F98] hover:text-[#0D3461] transition-colors"
              >
                Forgot password
              </button>
            </div>

            {showForgotHelp && (
              <div className="rounded-[8px] border border-[#E4E4E7] bg-[#F4F4F5] px-3 py-2.5 text-[12px] leading-relaxed text-[#52525B]">
                Contact your administrator to reset your password in User Management.
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
              className="w-full rounded-[8px] bg-[#A4CDE5] hover:bg-[#8DBFDC] text-[#0D3461] py-2.5 text-[13.5px] font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E4E4E7]" />
            <span className="text-[12px] text-[#52525B]">Or</span>
            <div className="flex-1 h-px bg-[#E4E4E7]" />
          </div>

          {/* Secondary Auth Options */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setShowSsoNotice((prev) => !prev)}
              className="w-full rounded-[8px] border border-[#D4D4D8] bg-white hover:bg-[#F4F4F5]/60 px-3.5 py-2.5 text-[13px] font-medium text-[#18181B] flex items-center justify-center gap-2.5 transition-colors"
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
              <div className="rounded-[8px] border border-[#E4E4E7] bg-[#F4F4F5] px-3 py-2 text-[12px] text-[#52525B]">
                Microsoft Entra SSO is not configured on this local instance yet. Please sign in with your email and password.
              </div>
            )}

          </div>

          <footer className="mt-7 text-center text-[11.5px] leading-[1.6] text-[#A1A1AA]">
            <div>Copyright Virtus Technology Indonesia · CTI Group 2026 ©</div>
            <div>All rights reserved.</div>
            <div>Version 0.0.1</div>
          </footer>
        </div>
      </div>

      {/* Right Column: Full-Bleed Office Lobby */}
      <div className="hidden lg:block lg:col-span-7 relative overflow-hidden bg-[#18181B]">
        <Image
          src="/images/office-lobby.png"
          alt="Virtus Technology Indonesia Office Lobby"
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover object-center"
        />
      </div>
    </div>
  );
}
