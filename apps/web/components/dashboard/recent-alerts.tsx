import Link from "next/link";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Alert {
  id: string;
  title: string;
  severity: string;
  createdAt: Date;
}

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === "critical") return <XCircle className="w-4 h-4 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <Info className="w-4 h-4 text-blue-500" />;
};

export function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle>Alertas Recentes</CardTitle>
        <Link href="/alerts" className="text-xs text-blue-600 hover:underline">
          Ver todos →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta recente</p>
        )}
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start gap-3">
            <SeverityIcon severity={alert.severity} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
              <p className="text-xs text-muted-foreground">{formatDate(alert.createdAt)}</p>
            </div>
            <Badge
              variant={
                alert.severity === "critical"
                  ? "critical"
                  : alert.severity === "warning"
                  ? "warning"
                  : "info"
              }
            >
              {alert.severity}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
