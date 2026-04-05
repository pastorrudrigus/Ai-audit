"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Zap, Building2, Users, Cpu, ShieldCheck,
  FileText, Key, TrendingUp, Bell, Settings, MessageSquare, ChevronLeft, Bot
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
  { href: "/gateway", label: "Gateway", icon: Zap },
  { href: "/platforms", label: "Plataformas", icon: Building2 },
  { href: "/departments", label: "Departamentos", icon: Users },
  { href: "/models", label: "Modelos", icon: Cpu },
  { href: "/policies", label: "Políticas", icon: ShieldCheck },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/keys", label: "API Keys", icon: Key },
  { href: "/optimizations", label: "Otimizações", icon: TrendingUp },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-foreground">AIGate</span>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-none",
              pathname === href || pathname.startsWith(`${href}/`)
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
