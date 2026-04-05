"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, AlertTriangle, Info, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";

interface Insight {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  estimatedSavingsMonthly: string | null;
  actionLabel: string | null;
  status: string;
  createdAt: string;
}

export default function OptimizationsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/optimizations").then(r => r.json()).then(data => {
      setInsights(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const totalSavings = insights
    .filter(i => i.status === "open")
    .reduce((s, i) => s + Number(i.estimatedSavingsMonthly ?? 0), 0);

  async function dismiss(id: string) {
    await fetch(`/api/optimizations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) });
    setInsights(prev => prev.filter(i => i.id !== id));
    toast.success("Insight descartado");
  }

  const SeverityIcon = ({ s }: { s: string }) => {
    if (s === "critical") return <XCircle className="w-4 h-4 text-red-500" />;
    if (s === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Otimizações" />
      <main className="flex-1 overflow-y-auto p-6">
        {totalSavings > 0 && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4 flex items-center gap-4">
              <TrendingDown className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Economia potencial total</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(totalSavings)}<span className="text-sm font-normal">/mês</span></p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && insights.filter(i => i.status === "open").length === 0 && (
          <EmptyState icon={TrendingDown} title="Tudo otimizado!" description="Não encontramos oportunidades de otimização no momento." />
        )}

        <div className="space-y-4">
          {insights.filter(i => i.status === "open").map((insight) => (
            <Card key={insight.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <SeverityIcon s={insight.severity} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{insight.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {insight.estimatedSavingsMonthly && (
                          <span className="text-sm font-semibold text-green-700">
                            {formatCurrency(Number(insight.estimatedSavingsMonthly))}/mês
                          </span>
                        )}
                        <Badge
                          variant={
                            insight.severity === "critical" ? "critical"
                            : insight.severity === "warning" ? "warning"
                            : "info"
                          }
                        >
                          {insight.severity}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {insight.actionLabel && (
                        <Button size="sm">{insight.actionLabel}</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => dismiss(insight.id)}>
                        Dispensar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
