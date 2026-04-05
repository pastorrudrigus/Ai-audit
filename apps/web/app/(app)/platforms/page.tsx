"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Building2 } from "lucide-react";

interface Subscription {
  id: string;
  planName: string;
  costMonthly: string;
  status: string;
  totalSeats: number | null;
  seats: Array<{ status: string }>;
  aiTool: { name: string; vendor: string; category: string; hasDpa: boolean; trainsOnData: string } | null;
  department: { name: string } | null;
}

export default function PlatformsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platforms").then((r) => r.json()).then(setSubs).finally(() => setLoading(false));
  }, []);

  const totalMonthly = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.costMonthly), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Plataformas & Assinaturas" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">
              {subs.filter(s => s.status === "active").length} assinaturas ativas ·{" "}
              <span className="font-medium text-foreground">{formatCurrency(totalMonthly)}/mês</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platforms/import">
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/platforms/add">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Link>
            </Button>
          </div>
        </div>

        {!loading && subs.length === 0 && (
          <EmptyState
            icon={Building2}
            title="Nenhuma plataforma cadastrada"
            description="Adicione as ferramentas de IA que sua empresa usa para começar a controlar os gastos."
            action={{ label: "Adicionar plataforma", href: "/platforms/add" }}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subs.map((sub) => {
            const activeSeats = sub.seats?.filter(s => s.status === "active").length ?? 0;
            const idleSeats = (sub.totalSeats ?? 0) - activeSeats;
            return (
              <Link key={sub.id} href={`/platforms/${sub.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{sub.aiTool?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{sub.aiTool?.vendor}</p>
                      </div>
                      <Badge
                        variant={
                          sub.status === "active" ? "success"
                          : sub.status === "cancelled" ? "destructive"
                          : "secondary"
                        }
                      >
                        {sub.status}
                      </Badge>
                    </div>

                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(Number(sub.costMonthly))}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{sub.planName}</span>
                      {sub.department && <span>{sub.department.name}</span>}
                    </div>

                    {sub.totalSeats && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-foreground">{activeSeats}/{sub.totalSeats} assentos ativos</span>
                        {idleSeats > 0 && (
                          <Badge variant="warning">{idleSeats} inativos</Badge>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex gap-1">
                      {sub.aiTool?.hasDpa ? (
                        <Badge variant="success" className="text-xs">DPA</Badge>
                      ) : (
                        <Badge variant="critical" className="text-xs">Sem DPA</Badge>
                      )}
                      {sub.aiTool?.trainsOnData === "yes" && (
                        <Badge variant="critical" className="text-xs">Treina dados</Badge>
                      )}
                      {sub.aiTool?.trainsOnData === "opt-out" && (
                        <Badge variant="warning" className="text-xs">Opt-out</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
