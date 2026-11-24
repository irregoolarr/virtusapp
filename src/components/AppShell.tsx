"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BellRing,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  Compass,
  Hash,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { cn, getInitials } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  permission?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, lookups, can, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("virtus.sidebarCollapsed") === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[13px] text-[#64748B]">
          <span className="w-2 h-2 rounded-full bg-[#FF2224] animate-ping" />
          Loading VirtusMS workspace...
        </div>
      </div>
    );
  }

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileOpen((v) => !v);
      return;
    }
    setCollapsed((v) => {
      try {
        localStorage.setItem("virtus.sidebarCollapsed", v ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !v;
    });
  };

  const sections: NavSection[] = [
    {
      items: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "dashboard:read" },
        { label: "Corrective", href: "/corrective", icon: Wrench, badge: lookups?.badges.corrective, permission: "maintenance:read" },
        { label: "Preventive", href: "/preventive", icon: CalendarCheck2, badge: lookups?.badges.preventive, permission: "maintenance:read" },
        { label: "Events & Alerts", href: "/events", icon: BellRing, badge: lookups?.badges.events, permission: "events:read" },
        { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
      ],
    },
    {
      title: "Operations & CRM",
      items: [
        { label: "Pipeline", href: "/pipeline", icon: TrendingUp, badge: lookups?.badges.pipeline, permission: "pipeline:read" },
        { label: "Implementations", href: "/implementations", icon: Layers, permission: "delivery:read" },
        { label: "POC Status", href: "/poc", icon: Compass, permission: "delivery:read" },
        { label: "Customers & Partners", href: "/customers", icon: Building2, permission: "customers:read" },
        { label: "Service Numbers", href: "/services", icon: Hash, permission: "services:read" },
        { label: "Products & Solutions", href: "/products", icon: Package, permission: "products:read" },
      ],
    },
    {
      title: "Administration",
      items: [
        { label: "Team & RBAC", href: "/team", icon: ShieldCheck, permission: "users:read" },
        { label: "Settings", href: "/settings", icon: Settings, permission: "settings:manage" },
      ],
    },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderNav = (compact: boolean) =>
    sections.map((section, si) => {
      const items = section.items.filter((item) => !item.permission || can(item.permission));
      if (items.length === 0) return null;
      return (
        <div key={si} className={si > 0 ? "mt-6" : ""}>
          {section.title &&
            (compact ? (
              <div className="mx-auto mb-2 w-6 border-t border-white/15" />
            ) : (
              <div className="px-3 mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-white/50">
                {section.title}
              </div>
            ))}
          <nav className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={compact ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md text-[13.5px] transition-colors",
                    compact ? "justify-center h-10" : "px-3 py-2.5",
                    active
                      ? "bg-white/[0.12] text-white font-medium"
                      : "text-white/75 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-[#FF2224]" />}
                  <Icon className="w-[18px] h-[18px] shrink-0 stroke-[1.75]" />
                  {!compact && <span className="flex-1 truncate">{item.label}</span>}
                  {!compact && typeof item.badge === "number" && item.badge > 0 && (
                    <span className="px-1.5 min-w-[20px] text-center py-0.5 text-[11px] font-medium rounded-full bg-white/15 text-white tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      );
    });

  const eventsBadge = lookups?.badges.events ?? 0;

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#0F172A]">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-30 h-14 bg-[#0B1F44] text-white flex items-center justify-between pl-3 pr-3 sm:pr-5 shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle navigation"
            className="w-10 h-10 rounded-md flex items-center justify-center text-white/85 hover:bg-white/10 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="bg-white rounded-md px-1.5 py-1 flex items-center">
              <Image src="/images/virtus-logo.png" alt="Virtus" width={36} height={38} className="h-7 w-auto object-contain" />
            </span>
            <span className="text-[16px] font-semibold tracking-[0.04em] truncate">VirtusMS</span>
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {can("events:read") && (
            <Link href="/events" title="Event schedule" className="hidden sm:flex w-10 h-10 rounded-md items-center justify-center text-white/85 hover:bg-white/10 hover:text-white">
              <CalendarDays className="w-5 h-5" />
            </Link>
          )}
          {can("users:read") && (
            <Link href="/team" title="Team" className="hidden sm:flex w-10 h-10 rounded-md items-center justify-center text-white/85 hover:bg-white/10 hover:text-white">
              <Users className="w-5 h-5" />
            </Link>
          )}
          {can("events:read") && (
            <Link href="/events" title={`${eventsBadge} scheduled reminders`} className="relative flex w-10 h-10 rounded-md items-center justify-center text-white/85 hover:bg-white/10 hover:text-white">
              <Bell className="w-5 h-5" />
              {eventsBadge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF2224] text-[10px] font-semibold leading-4 text-center tabular-nums">
                  {eventsBadge}
                </span>
              )}
            </Link>
          )}

          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5 h-10 pl-1.5 pr-2.5 rounded-md border border-white/25 hover:bg-white/10"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                style={{ backgroundColor: user.avatarColor || "#334155" }}
              >
                {getInitials(user.name)}
              </span>
              <span className="hidden md:block text-left leading-tight max-w-[160px]">
                <span className="block text-[12.5px] font-medium truncate">{user.name}</span>
                <span className="block text-[10.5px] text-white/60 truncate">{user.roleName}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-white/70" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] shadow-lg py-1.5 z-40">
                <div className="px-3.5 py-2 border-b border-[#F1F5F9]">
                  <div className="text-[13px] font-medium truncate">{user.name}</div>
                  <div className="text-[11.5px] text-[#64748B] truncate">{user.email}</div>
                </div>
                {can("users:read") && (
                  <Link href="/team" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-[#F8FAFC]">
                    <ShieldCheck className="w-4 h-4 text-[#64748B]" /> Team &amp; RBAC
                  </Link>
                )}
                <button
                  onClick={() => void logout()}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2]"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:block fixed top-14 bottom-0 left-0 z-20 bg-[#102A5C] overflow-y-auto transition-[width] duration-200",
          collapsed ? "w-[68px] px-2.5 py-4" : "w-[248px] px-3 py-5"
        )}
      >
        {renderNav(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 bottom-0 left-0 w-[264px] max-w-[84vw] bg-[#102A5C] px-3 py-4 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-2 mb-5">
              <span className="text-white text-[15px] font-semibold">VirtusMS</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="p-1.5 text-white/75 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className={cn("pt-14 transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]")}>
        <main className="min-w-0 flex flex-col min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
