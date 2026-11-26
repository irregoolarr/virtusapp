"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LookupsData } from "@/shared/types";
import { useToast } from "@/components/ToastProvider";

/** API calls whose 401 is an expected answer, not a sign that the session expired. */
const AUTH_PROBES = ["/api/auth/login", "/api/auth/me"];

function isSessionGuardedApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/") && !AUTH_PROBES.includes(url.pathname);
  } catch {
    return false;
  }
}

/** Where to send a signed-out user, remembering the page they were on. */
function loginPathFor(pathname: string): string {
  return pathname === "/" || pathname.startsWith("/login") ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
}

export type { LookupsData };

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  avatarColor: string;
  availability: string;
  roleId: number;
  roleName: string;
  roleSlug: string;
  permissions: string[];
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  lookups: LookupsData | null;
  can: (permission: string) => boolean;
  refreshAuth: () => Promise<void>;
  refreshLookups: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  lookups: null,
  can: () => false,
  refreshAuth: async () => {},
  refreshLookups: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<LookupsData | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useToast();
  const userRef = useRef<SessionUser | null>(null);
  userRef.current = user;
  const expiredNoticeShown = useRef(false);
  const signingOut = useRef(false);

  const refreshLookups = useCallback(async () => {
    try {
      const res = await fetch("/api/lookups", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLookups(data);
      }
    } catch {
      // ignore transient error
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        expiredNoticeShown.current = false;
        signingOut.current = false;
        await refreshLookups();
      } else {
        setUser(null);
        setLookups(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshLookups]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  // Pages call fetch("/api/...") directly, so watch every API response: a 401 while signed in
  // means the session is gone (expired, signed out elsewhere, or password changed on another
  // device). Drop the user; the redirect effect below then sends them to /login.
  useEffect(() => {
    const originalFetch = window.fetch;
    const watchedFetch: typeof window.fetch = async (input, init) => {
      const res = await originalFetch(input, init);
      if (res.status === 401 && userRef.current && isSessionGuardedApi(input)) {
        if (!expiredNoticeShown.current) {
          expiredNoticeShown.current = true;
          notify("Your session has expired. Please sign in again.", "error");
        }
        setUser(null);
        setLookups(null);
      }
      return res;
    };
    window.fetch = watchedFetch;
    return () => {
      if (window.fetch === watchedFetch) window.fetch = originalFetch;
    };
  }, [notify]);

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace(signingOut.current ? "/login" : loginPathFor(pathname));
    }
  }, [loading, user, pathname, router]);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const logout = useCallback(async () => {
    signingOut.current = true;
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLookups(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, lookups, can, refreshAuth, refreshLookups, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
