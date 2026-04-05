"use client";

import { useEffect, useState } from "react";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendTrendChart } from "@/components/dashboard/spend-trend-chart";
import { SavingsPanel } from "@/components/dashboard/savings-panel";
import { TopToolsTable } from "@/components/dashboard/top-tools-table";
import { RecentAlerts } from "@/components/dashboard/recent-alerts";
import { DashboardSkeleton } from "@/components/shared/loading-skeleton";

export function DashboardContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <div className="text-muted-foreground">Erro ao carregar dados.</div>;

  return (
    <div className="space-y-6">
      <KPICards data={data.kpi} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <SpendTrendChart data={data.trendData} />
        </div>
        <div className="space-y-4">
          <SavingsPanel insights={data.openInsights} totalSavings={data.totalSavings} />
          <RecentAlerts alerts={data.recentAlerts} />
        </div>
      </div>
      <TopToolsTable tools={data.topTools} />
    </div>
  );
}
