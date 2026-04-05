"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

interface KPIData {
  totalSpend: number;
  gatewaySpend: number;
  platformSpend: number;
  totalRequests: number;
  activeAlerts: number;
  prevTotalSpend: number;
  prevRequests: number;
}

function ChangeIndicator({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  const isUp = pct > 0;
  const isNeutral = Math.abs(pct) < 0.5;

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        isNeutral ? "text-muted-foreground" : isUp ? "text-red-600" : "text-green-600"
      )}
    >
      {isNeutral ? (
        <Minus className="w-3 h-3" />
      ) : isUp ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function KPICards({ data }: { data: KPIData }) {
  const cards = [
    {
      label: "Gasto Total (mês)",
      value: formatCurrency(data.totalSpend),
      sub: <ChangeIndicator current={data.totalSpend} prev={data.prevTotalSpend} />,
      color: "text-slate-900",
    },
    {
      label: "Gasto Gateway",
      value: formatCurrency(data.gatewaySpend),
      sub: <span className="text-xs text-blue-600 font-medium">via API</span>,
      color: "text-blue-700",
    },
    {
      label: "Gasto Plataformas",
      value: formatCurrency(data.platformSpend),
      sub: <span className="text-xs text-green-600 font-medium">subscrições</span>,
      color: "text-green-700",
    },
    {
      label: "Requests (mês)",
      value: formatNumber(data.totalRequests),
      sub: <ChangeIndicator current={data.totalRequests} prev={data.prevRequests} />,
      color: "text-slate-900",
    },
    {
      label: "Alertas Ativos",
      value: String(data.activeAlerts),
      sub: (
        <span className={cn("text-xs font-medium", data.activeAlerts > 0 ? "text-amber-600" : "text-green-600")}>
          {data.activeAlerts > 0 ? "requer atenção" : "tudo OK"}
        </span>
      ),
      color: data.activeAlerts > 0 ? "text-amber-700" : "text-slate-900",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
            <div className="mt-1">{card.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
