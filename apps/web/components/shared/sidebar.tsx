"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  Users,
  Cpu,
  ShieldCheck,
  FileText,
  Key,
  Bell,
  Settings,
  MessageSquare,
  Scale,
  ScanSearch,
} from "lucide-react";

/**
 * Sidebar do Tutela — vocabulário jurídico nos labels, MAS as rotas apontam
 * para as mesmas páginas do produto (org=banca, department=área, user=advogado
 * são renomeações visuais; o schema do banco não muda).
 */
const navItems = [
  { href: "/painel", label: "Painel do Sócio", icon: LayoutDashboard },
  { href: "/chat", label: "Portal do Advogado", icon: MessageSquare },
  { href: "/dashboard", label: "Visão técnica", icon: Zap, muted: true },
  { href: "/departments", label: "Áreas da banca", icon: Users },
  { href: "/policies", label: "Políticas de proteção", icon: ShieldCheck },
  { href: "/logs", label: "Auditoria de consultas", icon: FileText },
  { href: "/models", label: "Modelos disponíveis", icon: Cpu },
  { href: "/keys", label: "Credenciais de API", icon: Key },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-slate-200 gap-2">
        <div className="w-8 h-8 bg-[#1F5C45] rounded-md flex items-center justify-center">
          <Scale className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight">
          <span className="font-semibold text-slate-900 block text-sm">Tutela</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">
            IA sob controle
          </span>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, muted }) => {
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                active
                  ? "bg-[#1F5C45]/10 text-[#1F5C45] font-medium border-r-2 border-[#1F5C45]"
                  : muted
                  ? "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/policies/status"
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800"
        >
          <ScanSearch className="w-3.5 h-3.5 text-[#1F5C45]" />
          O que está ativo agora
        </Link>
      </div>
    </aside>
  );
}
