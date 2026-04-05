"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Users, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Seat {
  id: string;
  userEmail: string;
  userName: string | null;
  status: string;
  lastActiveAt: string | null;
}

interface Subscription {
  id: string;
  planName: string;
  costMonthly: string;
  status: string;
  totalSeats: number | null;
  billingCycle: string;
  renewalDate: string | null;
  seats: Seat[];
  aiTool: {
    name: string;
    vendor: string;
    category: string;
    hasDpa: boolean;
    hasSso: boolean;
    trainsOnData: string;
    websiteUrl: string;
    plans: Array<{ name: string; price_monthly: number | null; limits: string }>;
  } | null;
  department: { name: string } | null;
}

export default function SubscriptionDetailPage() {
  const params = useParams();
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    fetch(`/api/platforms/${params.id}`)
      .then((r) => r.json())
      .then(setSub);
  }, [params.id]);

  if (!sub) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="Plataforma" />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
        </main>
      </div>
    );
  }

  const activeSeats = sub.seats.filter((s) => s.status === "active");
  const idleSeats = sub.seats.filter(
    (s) =>
      s.status === "inactive" ||
      (s.lastActiveAt && new Date(s.lastActiveAt) < new Date(Date.now() - 30 * 86400000))
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={sub.aiTool?.name ?? "Plataforma"} />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platforms">
            <ChevronLeft className="w-4 h-4 mr-1" />Voltar
          </Link>
        </Button>

        {/* Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Custo mensal</p>
              <p className="text-2xl font-bold">{formatCurrency(Number(sub.costMonthly))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Assentos ativos</p>
              <p className="text-2xl font-bold text-green-600">{activeSeats.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Inativos &gt;30d</p>
              <p className="text-2xl font-bold text-amber-600">{idleSeats.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total contratado</p>
              <p className="text-2xl font-bold">{sub.totalSeats ?? "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Compliance & Segurança</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sub.aiTool?.hasDpa ? (
              <Badge variant="success">✓ DPA assinado</Badge>
            ) : (
              <Badge variant="critical">✗ Sem DPA</Badge>
            )}
            {sub.aiTool?.hasSso ? (
              <Badge variant="success">✓ SSO disponível</Badge>
            ) : (
              <Badge variant="warning">Sem SSO</Badge>
            )}
            {sub.aiTool?.trainsOnData === "no" && (
              <Badge variant="success">✓ Não treina com dados</Badge>
            )}
            {sub.aiTool?.trainsOnData === "opt-out" && (
              <Badge variant="warning">⚠ Treina por padrão (opt-out)</Badge>
            )}
            {sub.aiTool?.trainsOnData === "yes" && (
              <Badge variant="critical">✗ Treina com dados do usuário</Badge>
            )}
          </CardContent>
        </Card>

        {/* Idle seats warning */}
        {idleSeats.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-amber-900 text-sm">
                  {idleSeats.length} assento(s) inativo(s) há mais de 30 dias
                </p>
                <p className="text-xs text-amber-700">
                  Economia potencial:{" "}
                  {formatCurrency(
                    (Number(sub.costMonthly) / (sub.totalSeats || 1)) * idleSeats.length
                  )}
                  /mês removendo esses assentos
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seats table */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Assentos ({sub.seats.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Usuário</th>
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Email</th>
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Último uso</th>
                  <th className="text-center py-2 px-4 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sub.seats.map((seat) => (
                  <tr key={seat.id} className="border-b last:border-0">
                    <td className="py-2.5 px-4">{seat.userName ?? "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{seat.userEmail}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">
                      {seat.lastActiveAt ? formatDate(seat.lastActiveAt) : "Nunca"}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge
                        variant={
                          seat.status === "active" ? "success"
                          : seat.status === "inactive" ? "warning"
                          : "secondary"
                        }
                      >
                        {seat.status}
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
