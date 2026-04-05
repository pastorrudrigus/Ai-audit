"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, Info, CheckCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch("/api/alerts").then(r => r.json()).then(data => setAlerts(Array.isArray(data) ? data : []));
  }, []);

  async function markAllRead() {
    await fetch("/api/alerts", { method: "PATCH" });
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
    toast.success("Todos marcados como lidos");
  }

  const unread = alerts.filter(a => !a.isRead).length;

  const Icon = ({ severity }: { severity: string }) => {
    if (severity === "critical") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Alertas" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} não lido(s)` : "Todos lidos"}
          </p>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4 mr-2" />Marcar todos como lidos
            </Button>
          )}
        </div>

        {alerts.length === 0 && (
          <EmptyState icon={Info} title="Nenhum alerta" description="Tudo está funcionando normalmente." />
        )}

        <div className="space-y-3">
          {alerts.map(alert => (
            <Card key={alert.id} className={!alert.isRead ? "border-l-4 border-l-amber-400" : ""}>
              <CardContent className="pt-4 pb-4 flex items-start gap-3">
                <Icon severity={alert.severity} />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs text-muted-foreground">{formatDate(alert.createdAt)}</span>
                      <Badge
                        variant={alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "info"}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
