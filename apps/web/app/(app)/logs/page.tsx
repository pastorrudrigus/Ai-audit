"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Log {
  id: string;
  source: string;
  providerType: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  latencyMs: number;
  status: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    fetch("/api/logs").then(r => r.json()).then(data => setLogs(Array.isArray(data) ? data : []));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Logs de Requisições" />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Modelo</th>
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Fonte</th>
                  <th className="text-right py-2 px-4 text-xs text-muted-foreground font-medium">Tokens</th>
                  <th className="text-right py-2 px-4 text-xs text-muted-foreground font-medium">Custo</th>
                  <th className="text-right py-2 px-4 text-xs text-muted-foreground font-medium">Latência</th>
                  <th className="text-center py-2 px-4 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{formatDate(log.createdAt)}</td>
                    <td className="py-2.5 px-4 font-mono text-xs">{log.modelId}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant="outline" className="text-xs">{log.source}</Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs">{log.inputTokens + log.outputTokens}</td>
                    <td className="py-2.5 px-4 text-right text-xs">${parseFloat(log.costUsd).toFixed(4)}</td>
                    <td className="py-2.5 px-4 text-right text-xs">{log.latencyMs}ms</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge
                        variant={
                          log.status === "success" ? "success"
                          : log.status === "blocked_dlp" ? "critical"
                          : "warning"
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
