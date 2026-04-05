"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  monthlyBudget: string | null;
  budgetAlertThreshold: number;
}

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Department[]>([]);

  useEffect(() => {
    fetch("/api/departments").then(r => r.json()).then(data => setDepts(Array.isArray(data) ? data : []));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Departamentos" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {depts.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-5 pb-4">
                <p className="font-semibold text-foreground">{d.name}</p>
                {d.monthlyBudget && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Budget: {formatCurrency(Number(d.monthlyBudget))}/mês
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Alerta em {d.budgetAlertThreshold}%
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
