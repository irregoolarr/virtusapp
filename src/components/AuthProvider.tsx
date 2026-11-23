"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

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

export interface LookupCustomer {
  id: number;
  name: string;
  code: string;
}
export interface LookupPartner {
  id: number;
  name: string;
  code: string;
}
export interface LookupProduct {
  id: number;
  name: string;
  sku: string;
}
export interface LookupService {
  id: number;
  serviceNumber: string;
  title: string;
  customerId: number;
}
export interface LookupUser {
  id: number;
  name: string;
  email: string;
  jobTitle: string;
  avatarColor: string;
  availability: string;
}
export interface LookupRole {
  id: number;
  name: string;
  slug: string;
}

export interface LookupsData {
  customers: LookupCustomer[];
  partners: LookupPartner[];
  products: LookupProduct[];
  services: LookupService[];
  users: LookupUser[];
  roles: LookupRole[];
  badges: {
    corrective: number;
    preventive: number;
    pipeline: number;
    events: number;
  };
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

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login");
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
