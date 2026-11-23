"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  CalendarCheck2,
  Compass,
  Hash,
  Home,
  Layers,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  TrendingUp,
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, lookups, can, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-[13px] text-[#78787E]">
          <span className="w-2 h-2 rounded-full bg-[#18181A] animate-ping" />
          Loading VirtusMS workspace...
        </div>
      </div>
    );
  }

  const primaryNav: NavItem[] = [
    { label: "Dashboard", href: "/", icon: Home, permission: "dashboard:read" },
    {
      label: "Corrective",
      href: "/corrective",
      icon: Wrench,
      badge: lookups?.badges.corrective,
      permission: "maintenance:read",
    },
    {
      label: "Preventive",
      href: "/preventive",
      icon: CalendarCheck2,
      badge: lookups?.badges.preventive,
      permission: "maintenance:read",
    },
    {
      label: "Events & Alerts",
      href: "/events",
      icon: BellRing,
      badge: lookups?.badges.events,
      permission: "events:read",
    },
    { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
  ];

  const deliveryNav: NavItem[] = [
    {
      label: "Pipeline",
      href: "/pipeline",
      icon: TrendingUp,
      badge: lookups?.badges.pipeline,
      permission: "pipeline:read",
    },
    { label: "Implementations", href: "/implementations", icon: Layers, permission: "delivery:read" },
    { label: "POC Status", href: "/poc", icon: Compass, permission: "delivery:read" },
    { label: "Customers & Partners", href: "/customers", icon: Building2, permission: "customers:read" },
    { label: "Service Numbers", href: "/services", icon: Hash, permission: "services:read" },
    { label: "Products & Solutions", href: "/products", icon: Package, permission: "products:read" },
  ];

  const governanceNav: NavItem[] = [
    { label: "Team & RBAC", href: "/team", icon: ShieldCheck, permission: "users:read" },
    { label: "Settings", href: "/settings", icon: Settings, permission: "settings:manage" },
  ];

  const renderNavList = (items: NavItem[]) =>
    items
      .filter((item) => !item.permission || can(item.permission))
      .map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-[10px] text-[13.5px] transition-colors",
              active
                ? "bg-[#F4F4F1] text-[#18181A] font-medium"
                : "text-[#54545A] hover:bg-[#FAF9F6] hover:text-[#18181A]"
            )}
          >
            <span className="flex items-center gap-2.5 truncate">
              <Icon
                className={cn(
                  "w-[16px] h-[16px] shrink-0 stroke-[1.7]",
                  active ? "text-[#18181A]" : "text-[#6D6D73]"
                )}
              />
              <span className="truncate">{item.label}</span>
            </span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-[#F1F1EC] text-[#54545A] tabular-nums">
                {item.badge}
              </span>
            )}
          </Link>
        );
      });

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between px-4 py-5 bg-white">
      <div className="overflow-y-auto pr-0.5">
        {/* Brand */}
        <div className="flex items-center justify-between px-2.5 mb-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-[7px] bg-[#18181A] text-white text-[12px] font-semibold flex items-center justify-center">
              V
            </span>
            <span className="text-[19px] font-semibold tracking-tight text-[#18181A]">
              VirtusMS
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-[#78787E] hover:text-[#18181A]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary */}
        <nav className="space-y-0.5">{renderNavList(primaryNav)}</nav>

        {/* Delivery & CRM */}
        <div className="mt-6">
          <div className="px-3 mb-1.5 text-[11px] font-medium text-[#9A9AA0]">
            Operations & CRM
          </div>
          <nav className="space-y-0.5">{renderNavList(deliveryNav)}</nav>
        </div>

        {/* Governance */}
        {governanceNav.some((g) => !g.permission || can(g.permission)) && (
          <div className="mt-5">
            <div className="px-3 mb-1.5 text-[11px] font-medium text-[#9A9AA0]">
              Administration
            </div>
            <nav className="space-y-0.5">{renderNavList(governanceNav)}</nav>
          </div>
        )}

        {/* Members */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-medium text-[#9A9AA0]">Members</span>
            {can("users:manage") && (
              <Link
                href="/team"
                title="Manage team members"
                className="text-[#78787E] hover:text-[#18181A] p-0.5 rounded"
              >
                <Plus className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <div className="space-y-2 px-2">
            {(lookups?.users ?? []).slice(0, 4).map((member) => (
              <Link
                key={member.id}
                href="/team"
                className="flex items-center gap-2.5 py-0.5 rounded-lg hover:bg-[#FAF9F6] px-1 transition-colors"
              >
                <div className="relative shrink-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium text-white"
                    style={{ backgroundColor: member.avatarColor || "#18181A" }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white",
                      member.availability === "Online" || member.availability === "On Duty"
                        ? "bg-emerald-500"
                        : member.availability === "Away"
                          ? "bg-amber-400"
                          : "bg-zinc-300"
                    )}
                  />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-[12.5px] font-medium text-[#18181A] truncate">
                    {member.name}
                  </div>
                  <div className="text-[10.5px] text-[#8E8E93] truncate">{member.jobTitle}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom User Bar */}
      <div className="pt-4 mt-4 border-t border-[#F0F0EB] px-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium text-white shrink-0"
            style={{ backgroundColor: user.avatarColor || "#18181A" }}
          >
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[12.5px] font-medium text-[#18181A] truncate">{user.name}</div>
            <div className="text-[10.5px] text-[#8E8E93] truncate">{user.roleName}</div>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          title="Sign out"
          className="p-1.5 rounded-lg text-[#78787E] hover:text-[#18181A] hover:bg-[#F4F4F1] transition-colors shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-white text-[#18181A]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[240px] shrink-0 border-r border-[#ECECE7] sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-[256px] max-w-[82vw] h-full border-r border-[#ECECE7] bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Top Strip */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#F3F3EB] border-b border-[#E8E8DF]">
          <button
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#18181A]"
          >
            <Menu className="w-5 h-5" />
            VirtusMS
          </button>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#E4E4DC] text-[#54545A]">
            {user.roleName}
          </span>
        </div>

        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </div>
  );
}
