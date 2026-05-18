"use client";

import {
  Activity,
  ArrowLeftRight,
  Banknote,
  Bell,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  FileText,
  Gauge,
  GitCompareArrows,
  History,
  LayoutDashboard,
  LineChart,
  NotebookPen,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const nav = [
  {
    label: "Mercado",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Snapshot" },
      { href: "/curves", icon: LineChart, label: "Curvas" },
      { href: "/spreads", icon: GitCompareArrows, label: "Spreads" },
      { href: "/inflation", icon: Activity, label: "Inflación · BEI" },
    ],
  },
  {
    label: "Instrumentos",
    items: [
      { href: "/bonds", icon: Calculator, label: "Calculadora bonos" },
      { href: "/funds", icon: Banknote, label: "Fondos mutuos CL" },
      { href: "/etfs", icon: TrendingUp, label: "ETFs USA" },
      { href: "/issuers", icon: Building2, label: "Emisores" },
    ],
  },
  {
    label: "Tesorería",
    items: [
      { href: "/portfolio", icon: Wallet, label: "Cartera" },
      { href: "/cash-ladder", icon: Briefcase, label: "Cash ladder" },
      { href: "/stress", icon: Zap, label: "Stress testing" },
      { href: "/tax", icon: Receipt, label: "Tributario" },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/analog", icon: History, label: "Análogo histórico" },
      { href: "/backtest", icon: Gauge, label: "Backtesting" },
      { href: "/ml", icon: Brain, label: "Análisis ML" },
    ],
  },
  {
    label: "Operación",
    items: [
      { href: "/watchlist", icon: Bell, label: "Watchlist" },
      { href: "/journal", icon: NotebookPen, label: "Diario" },
      { href: "/reports", icon: FileText, label: "Reportes" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center bg-foreground text-background">
            <ArrowLeftRight className="h-3 w-3" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
              Treasury Desk
            </span>
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              Bonds · CLP · USD
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        {nav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        size="sm"
                        render={<Link href={item.href} />}
                      >
                        <Icon strokeWidth={1.8} />
                        <span className="text-xs">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
