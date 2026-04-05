"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function GatewayPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/gateway/spend").then(r => r.json()).then(setStats);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Gateway — Uso e Gasto" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {stats && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Gasto (mês)</p><p className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Requests</p><p className="text-2xl font-bold">{stats.totalRequests}</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Bloqueados DLP</p><p className="text-2xl font-bold text-red-600">{stats.blockedDlp}</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Latência média</p><p className="text-2xl font-bold">{stats.avgLatency}ms</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Gasto diário</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.dailySpend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, "Custo"]} />
                    <Area type="monotone" dataKey="cost" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Uso por modelo</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-2 px-4 text-xs text-muted-foreground">Modelo</th>
                    <th className="text-right py-2 px-4 text-xs text-muted-foreground">Requests</th>
                    <th className="text-right py-2 px-4 text-xs text-muted-foreground">Tokens</th>
                    <th className="text-right py-2 px-4 text-xs text-muted-foreground">Custo</th>
                  </tr></thead>
                  <tbody>
                    {(stats.byModel ?? []).map((row: any) => (
                      <tr key={row.modelId} className="border-b last:border-0">
                        <td className="py-2 px-4 font-mono text-xs">{row.modelId}</td>
                        <td className="py-2 px-4 text-right">{row.requests}</td>
                        <td className="py-2 px-4 text-right">{row.tokens}</td>
                        <td className="py-2 px-4 text-right">{formatCurrency(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
